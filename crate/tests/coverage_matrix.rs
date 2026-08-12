//! Does this crate open what it claims to open?
//!
//! Before 0.2.0 the walk yielded only the formats a typed extractor
//! read, which meant a repository of eighty-eight file types was audited
//! as twenty-one of them — and nothing said so, because a file that is
//! never opened produces no report line to be missing. The gap was found
//! by counting extensions in a real tree by hand.
//!
//! So: one file per entry in the alias table, plus a dozen extensions
//! the table has never heard of, run through the built binary. Every one
//! of them must come back with a report line naming the format that read
//! it. A format the walk skips fails here; a format that resolves to the
//! wrong extractor fails here.
//!
//! **The expected mapping is read out of `src/extract/format.rs`
//! itself**, not copied. A copy is a second source of truth that agrees
//! until the day somebody edits one of them.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const BINARY: &str = env!("CARGO_BIN_EXE_paths-le");
const FORMAT_SOURCE: &str = include_str!("../src/extract/format.rs");
const EXTRACTION_CORPUS: &str = include_str!("../fixtures/extraction.json");

/// Extensions no alias covers. Every one of them must still be opened,
/// read by the generic scan, and reported as `unknown` — that is the
/// whole point of the widening.
const UNKNOWN_EXTENSIONS: [&str; 12] = [
    "rs", "go", "py", "rb", "java", "swift", "kt", "sh", "sql", "mk", "txt", "ini",
];

/// The body of a `const NAME: [...; N] = [ ... ];` declaration, with the
/// declared length. Both are returned so the parse can check itself:
/// a table that grew a row the parser did not see would otherwise
/// silently shrink this test.
fn table<'a>(source: &'a str, name: &str) -> (&'a str, usize) {
    let at = source
        .find(&format!("const {name}:"))
        .unwrap_or_else(|| panic!("{name} is gone from format.rs"));
    let rest = &source[at..];
    let declared: usize = rest
        .split_once("; ")
        .and_then(|(_, tail)| tail.split_once(']'))
        .and_then(|(count, _)| count.trim().parse().ok())
        .unwrap_or_else(|| panic!("{name} does not declare its length"));
    let body = rest
        .split_once("= [")
        .and_then(|(_, tail)| tail.split_once("\n];"))
        .map_or_else(
            || panic!("{name} is not the array literal this expects"),
            |(body, _)| body,
        );
    (body, declared)
}

/// Every string literal in a slice of source, in order.
fn literals(body: &str) -> Vec<String> {
    let mut found = Vec::new();
    let mut rest = body;
    while let Some(open) = rest.find('"') {
        let after = &rest[open + 1..];
        let Some(close) = after.find('"') else {
            break;
        };
        found.push(after[..close].to_string());
        rest = &after[close + 1..];
    }
    found
}

/// The alias table as the engine holds it: what a caller may write, and
/// the language id it becomes.
fn aliases() -> Vec<(String, String)> {
    let (body, declared) = table(FORMAT_SOURCE, "ALIASES");
    let strings = literals(body);
    assert_eq!(
        strings.len(),
        declared * 2,
        "ALIASES declares {declared} rows and this read {} strings — the table \
         is no longer the shape this test parses, so it is testing less than it says",
        strings.len()
    );
    strings
        .chunks_exact(2)
        .map(|pair| (pair[0].clone(), pair[1].clone()))
        .collect()
}

fn supported_formats() -> Vec<String> {
    let (body, declared) = table(FORMAT_SOURCE, "SUPPORTED_FORMATS");
    let formats = literals(body);
    assert_eq!(formats.len(), declared, "SUPPORTED_FORMATS changed shape");
    formats
}

fn fallback_format() -> String {
    let at = FORMAT_SOURCE
        .find("const FALLBACK_FORMAT:")
        .expect("FALLBACK_FORMAT is gone from format.rs");
    literals(&FORMAT_SOURCE[at..])
        .first()
        .cloned()
        .expect("FALLBACK_FORMAT has no value")
}

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("paths-le-matrix-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("a temporary directory");
        Self {
            root: std::fs::canonicalize(&root).expect("a canonical directory"),
        }
    }

    fn path(&self) -> &Path {
        &self.root
    }
}

impl Drop for Tree {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

/// Every report the binary wrote, keyed by file name.
fn scan(root: &Path) -> BTreeMap<String, serde_json::Value> {
    let output = Command::new(BINARY)
        .arg(root)
        .stdin(Stdio::null())
        .output()
        .expect("the binary runs");
    let code = output.status.code().expect("an exit code, not a signal");
    assert!(
        (0..=1).contains(&code),
        "the matrix tree must be examinable: exit {code}\n{}",
        String::from_utf8_lossy(&output.stderr)
    );

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let report: serde_json::Value =
                serde_json::from_str(line).expect("stdout carries only JSON");
            let file = report["file"].as_str().expect("a file");
            // Report paths spell their separators forward on every
            // platform, which is why splitting on `/` is enough here.
            let name = file.rsplit('/').next().expect("a name").to_string();
            (name, report)
        })
        .collect()
}

#[test]
fn every_extension_the_alias_table_names_is_opened_and_named() {
    let aliases = aliases();
    let tree = Tree::new("aliases");
    // The value every document carries, so a file that was opened is
    // also visibly a file that was read.
    std::fs::write(tree.path().join("t.txt"), "").expect("a target");

    let mut expected: BTreeMap<String, String> = BTreeMap::new();
    for (from, to) in &aliases {
        let name = format!("case-{from}.{from}");
        std::fs::write(tree.path().join(&name), "{\"a\":\"./t.txt\"}\n").expect("a document");
        expected.insert(name, to.clone());
    }

    let reports = scan(tree.path());
    let mut missing = Vec::new();
    let mut misread = Vec::new();
    for (name, language) in &expected {
        let Some(report) = reports.get(name) else {
            missing.push(name.clone());
            continue;
        };
        let format = report["format"].as_str().unwrap_or("");
        if format != language {
            misread.push(format!("{name}: read as {format}, not {language}"));
        }
    }

    assert!(
        missing.is_empty(),
        "{} of {} alias extensions produced no report line at all: {missing:?}",
        missing.len(),
        expected.len()
    );
    assert!(misread.is_empty(), "{misread:#?}");
}

/// A format the table has never heard of is the common case, not the
/// exception: four fifths of a repository is extensions nothing here
/// names. Every one must be opened and reported as the generic scan.
#[test]
fn every_extension_the_table_does_not_know_is_still_opened() {
    let fallback = fallback_format();
    let tree = Tree::new("unknown");
    std::fs::write(tree.path().join("t.txt"), "").expect("a target");
    for extension in UNKNOWN_EXTENSIONS {
        std::fs::write(
            tree.path().join(format!("case-{extension}.{extension}")),
            "see ./t.txt\n",
        )
        .expect("a document");
    }
    // A name with no extension at all, which is where a naive split
    // would take the whole filename for one.
    std::fs::write(tree.path().join("Dockerfile"), "COPY ./t.txt /app\n").expect("a document");

    let reports = scan(tree.path());
    for extension in UNKNOWN_EXTENSIONS {
        let name = format!("case-{extension}.{extension}");
        let report = reports
            .get(&name)
            .unwrap_or_else(|| panic!("{name} produced no report line"));
        assert_eq!(report["format"], fallback, "{name}");
        assert_eq!(
            report["paths"][0]["value"], "./t.txt",
            "{name} was opened and not read"
        );
    }
    let dockerfile = reports
        .get("Dockerfile")
        .expect("Dockerfile produced no report line");
    assert_eq!(dockerfile["format"], fallback);
    assert_eq!(dockerfile["paths"][0]["value"], "./t.txt");
}

/// **A format the schema advertises with no corpus document is a
/// failure.** The enum is what tells an agent the ask is understood, so
/// a name in it that no shared case ever runs is a promise neither
/// frontend is held to.
#[test]
fn every_advertised_format_has_a_case_in_the_shared_corpus() {
    let cases: Vec<serde_json::Value> =
        serde_json::from_str(EXTRACTION_CORPUS).expect("the corpus is valid JSON");
    let covered: Vec<&str> = cases
        .iter()
        .filter_map(|case| case["languageId"].as_str())
        .collect();

    let uncovered: Vec<String> = supported_formats()
        .into_iter()
        .filter(|format| !covered.contains(&format.as_str()))
        .collect();
    assert!(
        uncovered.is_empty(),
        "advertised in SUPPORTED_FORMATS with no case in fixtures/extraction.json: {uncovered:?}"
    );
}
