//! A standing net over the pure layer: the path heuristics, the format
//! table and the extractors behind them, fed arbitrary text until the
//! clock runs out.
//!
//! **Why not `cargo-fuzz`.** It needs a library target to link a fuzz
//! harness against, and this crate deliberately has none — `extract/` is
//! `pub(crate)` and the package ships one binary. Adding a `[lib]` to
//! reach it would make the whole extraction layer public API, which is
//! the opposite of the decision AGENTS.md records.
//!
//! **Why not `proptest`.** `cargo test` on the published tarball is how
//! a consumer checks the parity claims rather than trusting them, so a
//! dev-dependency is a dependency they have to fetch to do it — and
//! AGENTS.md is explicit that dependencies are a cost. The generator
//! below is sixty lines, seeded, and prints the seed and the failing
//! input, which is all a shrinking harness would have given here.
//!
//! **What counts as a failure:** a panic, a slice off a character
//! boundary (which panics), a stall, or an answer that puts a path
//! somewhere the document does not reach. `PATHS_LE_FUZZ_SECONDS` sets
//! the per-target budget — CI gives each 60 seconds; the default keeps
//! `cargo test` quick.

use std::time::{Duration, Instant};

use super::format::{FALLBACK_FORMAT, SUPPORTED_FORMATS, determine_file_type, resolve_format};
use super::{corpus, extract, heuristics};

const HEURISTICS: &str = include_str!("../../fixtures/heuristics.json");

/// A single call may not take longer than this. Catastrophic
/// backtracking is exponential, so anything that trips it blows past a
/// generous bound rather than creeping up to it — and a bound that
/// tracked the machine would be a bound that never fires on a fast one.
const PER_INPUT: Duration = Duration::from_secs(2);

/// Long enough to be a net, short enough that `cargo test` stays a thing
/// people run. CI raises it to the 60 seconds per target the hardening
/// spec asks for.
const DEFAULT_SECONDS: u64 = 2;

/// Bounded so a failure is readable and the budget buys iterations
/// rather than one enormous document.
const MAX_DOCUMENT: usize = 16 * 1024;

fn budget() -> Duration {
    let seconds = std::env::var("PATHS_LE_FUZZ_SECONDS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(DEFAULT_SECONDS);
    Duration::from_secs(seconds)
}

fn seed() -> u64 {
    std::env::var("PATHS_LE_FUZZ_SEED")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0x5ea1_0000_0002_0000)
}

/// splitmix64. Deterministic, tiny, and identical on every platform, so
/// a seed printed by a red build reproduces the exact input everywhere.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9e37_79b9_7f4a_7c15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
        z ^ (z >> 31)
    }

    fn below(&mut self, bound: usize) -> usize {
        (self.next() % bound as u64) as usize
    }

    fn pick<'a, T>(&mut self, items: &'a [T]) -> &'a T {
        &items[self.below(items.len())]
    }
}

/// The characters that decide a path heuristic's answer, plus the ones
/// that have broken one: quotes and the forbidden set, both separators,
/// the two whitespace characters JavaScript and Unicode disagree about,
/// a line terminator, an astral scalar, and a lone combining mark.
const ALPHABET: [char; 40] = [
    '/',
    '\\',
    '.',
    ':',
    '-',
    '_',
    '~',
    '#',
    '?',
    '*',
    '|',
    '<',
    '>',
    '"',
    '\'',
    '`',
    ' ',
    '\t',
    '\n',
    '\r',
    'a',
    'z',
    'A',
    'Z',
    '0',
    '9',
    '{',
    '}',
    '[',
    ']',
    '(',
    ')',
    ',',
    ';',
    '=',
    '\u{feff}',
    '\u{85}',
    '\u{2028}',
    '\u{1f3af}',
    '\u{300}',
];

/// Real material to mutate: every value the shared heuristics corpus
/// pins, and every document the extraction corpus runs. A mutation of a
/// document that already parses reaches deep into an extractor; a random
/// string mostly gets rejected at the door.
fn seeds() -> Vec<String> {
    let mut pool: Vec<String> = Vec::new();
    let corpus: serde_json::Value =
        serde_json::from_str(HEURISTICS).expect("the corpus is valid JSON");
    for key in ["isPathLike", "classifyPathType"] {
        let Some(cases) = corpus[key].as_array() else {
            continue;
        };
        pool.extend(
            cases
                .iter()
                .filter_map(|case| case["input"].as_str())
                .map(str::to_string),
        );
    }
    pool.extend(
        corpus::DOCUMENTS
            .iter()
            .map(|(_, content)| (*content).to_string()),
    );
    assert!(!pool.is_empty(), "the corpus seeded nothing");
    pool
}

/// One generated value: sometimes a seed, usually a seed with something
/// done to it, occasionally noise from the alphabet alone.
fn candidate(rng: &mut Rng, pool: &[String], limit: usize) -> String {
    let mut value = match rng.below(8) {
        0 => String::new(),
        1..=2 => (0..rng.below(48)).map(|_| *rng.pick(&ALPHABET)).collect(),
        _ => rng.pick(pool).clone(),
    };
    for _ in 0..=rng.below(4) {
        value = mutate(rng, &value, limit);
    }
    value
}

fn mutate(rng: &mut Rng, value: &str, limit: usize) -> String {
    if value.len() > limit {
        return truncate_on_boundary(value, limit);
    }
    let character = *rng.pick(&ALPHABET);
    match rng.below(6) {
        0 => format!("{character}{value}"),
        1 => format!("{value}{character}"),
        2 => {
            let at = floor_to_boundary(value, rng.below(value.len().max(1)));
            format!("{}{character}{}", &value[..at], &value[at..])
        }
        3 => {
            let at = floor_to_boundary(value, rng.below(value.len().max(1)));
            truncate_on_boundary(&value[at..], limit)
        }
        // Repetition is what turns a linear scan quadratic and a
        // backtracking pattern exponential, so it has to be reachable.
        4 => truncate_on_boundary(&value.repeat(2 + rng.below(6)), limit),
        _ => truncate_on_boundary(
            &format!("{}{value}", character.to_string().repeat(rng.below(64))),
            limit,
        ),
    }
}

fn floor_to_boundary(value: &str, mut at: usize) -> usize {
    while at > 0 && !value.is_char_boundary(at) {
        at -= 1;
    }
    at
}

fn truncate_on_boundary(value: &str, limit: usize) -> String {
    if value.len() <= limit {
        return value.to_string();
    }
    value[..floor_to_boundary(value, limit)].to_string()
}

/// Escaped, because a failing input is usually invisible characters and
/// a raw one in the log is a bug report nobody can act on.
fn readable(value: &str) -> String {
    value.escape_debug().to_string()
}

/// Run one target until the budget is spent, timing every call.
fn hammer(target: &str, limit: usize, mut check: impl FnMut(&str)) {
    let seed = seed();
    let budget = budget();
    let pool = seeds();
    let mut rng = Rng(seed);
    let started = Instant::now();
    let mut iterations = 0u64;

    while started.elapsed() < budget {
        let input = candidate(&mut rng, &pool, limit);
        let call = Instant::now();
        check(&input);
        let elapsed = call.elapsed();
        assert!(
            elapsed < PER_INPUT,
            "{target} took {elapsed:?} on iteration {iterations} (seed {seed}): \"{}\"",
            readable(&input)
        );
        iterations += 1;
    }
    eprintln!("fuzz {target}: {iterations} inputs in {budget:?} (seed {seed})");
    assert!(iterations > 0, "{target} ran no inputs");
}

#[test]
fn is_path_like_answers_for_anything() {
    hammer("is_path_like", 4096, |input| {
        // Deterministic as well as total: a pattern engine that answered
        // differently twice would be a far worse bug than a panic.
        assert_eq!(
            heuristics::is_path_like(input),
            heuristics::is_path_like(input)
        );
    });
}

#[test]
fn classify_path_type_answers_for_anything() {
    hammer("classify_path_type", 4096, |input| {
        let kind = heuristics::classify_path_type(input);
        // Classification is independent of the heuristic: it answers for
        // values `is_path_like` rejects, which is what the extractors
        // rely on when they classify a token they already accepted.
        assert_eq!(kind, heuristics::classify_path_type(input));
    });
}

#[test]
fn a_resolved_format_is_always_one_the_engine_dispatches() {
    hammer("resolve_format", 512, |input| {
        for language in [
            resolve_format(Some(input), None),
            resolve_format(None, Some(input)),
            resolve_format(Some(input), Some(input)),
        ] {
            let typed = determine_file_type(language) != super::FileType::Unknown;
            assert!(
                typed || matches!(language, FALLBACK_FORMAT | "markdown" | "xml"),
                "{} resolved to {language}, which the engine reads as neither a typed \
                 format nor a declared generic scan",
                readable(input)
            );
        }
    });
}

/// The whole engine over arbitrary text, in every format it answers to.
/// This is the target that catches a slice landing mid-character —
/// the bug that ended a run with SIGABRT rather than an exit code.
#[test]
fn extraction_never_panics_and_stays_inside_the_document() {
    let mut languages: Vec<&str> = SUPPORTED_FORMATS.to_vec();
    languages.extend(["jsonc", "scss", "less", "xml", "python", FALLBACK_FORMAT]);
    let mut turn = 0usize;

    hammer("extract", MAX_DOCUMENT, move |input| {
        let language = languages[turn % languages.len()];
        turn += 1;
        let result = extract(input, language);
        // CSV and TSV positions are cell coordinates rather than
        // offsets, so the line bound below does not apply to them.
        let lines = 1 + input.bytes().filter(|byte| *byte == b'\n').count();
        for path in &result.paths {
            assert!(
                path.position.line >= 1 && path.position.column >= 1,
                "{language} put a path at {}:{} in \"{}\"",
                path.position.line,
                path.position.column,
                readable(input)
            );
            assert!(
                language == "csv" || language == "tsv" || path.position.line <= lines,
                "{language} put a path on line {} of a {lines}-line document: \"{}\"",
                path.position.line,
                readable(input)
            );
        }
    });
}
