//! A wall-clock ceiling on a fixed tree, and a linearity check on top
//! of it.
//!
//! secrets-le was fifty times slower than its siblings for a whole
//! release and nobody noticed, because nothing measured it. Here the
//! expensive half is resolution — every extracted path becomes a
//! `symlink_metadata` and a `canonicalize`, and a widened walk multiplies
//! the number of paths rather than the number of files: one real
//! TypeScript application went from 487 paths to 6,555 when the walk
//! stopped filtering by format, and 5,367 of those came out of a single
//! lockfile.
//!
//! The generated tree reproduces that shape and the measurement holds:
//! **501 files, 3,000 paths, of which the single lockfile contributes
//! 2,000 — two thirds of everything the scan reports.** That is the
//! composition the README's `.ignore` note is about, and it is why the
//! ceiling is set on a tree with a lockfile in it rather than on
//! well-behaved source.
//!
//! **Gated behind `PATHS_LE_BUDGET`**, like the scenarios, because a
//! timing assertion on somebody else's laptop is a coin toss rather than
//! a test. CI runs it on one machine, in release, on a tree generated
//! from a fixed seed rather than checked in — 500 files of committed
//! filler would be 500 files every clone pays for and nobody reads.

use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const BINARY: &str = env!("CARGO_BIN_EXE_paths-le");

/// The generated tree: enough files that per-file cost dominates
/// start-up, and enough paths per file that resolution is what is being
/// measured.
const FILES: usize = 500;

/// **Measured locally at 0.36 s** — release build, Apple M-series
/// laptop, the 501-file tree below, 3,000 paths, cold. The ceiling is
/// 10× that: loose enough not to flake on a shared runner, tight enough
/// to catch an order of magnitude.
///
/// Re-measure with:
/// `PATHS_LE_BUDGET=1 cargo test --release --test budget -- --nocapture`
const CEILING: Duration = Duration::from_secs(3);

/// Four times the tree may not cost more than six times the time.
/// Anything quadratic blows straight through this; the position-lookup
/// bug that was quadratic on one long line is the case it stands for.
const LINEARITY: f64 = 6.0;

/// Returns false and says so when the gate is closed.
fn enabled(name: &str) -> bool {
    if std::env::var_os("PATHS_LE_BUDGET").is_some() {
        return true;
    }
    eprintln!("SKIPPED {name}: set PATHS_LE_BUDGET to run it");
    false
}

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("paths-le-budget-{name}-{}", std::process::id()));
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

/// A deterministic pseudo-repository: sources that import each other,
/// configs, a lockfile-shaped document, and a directory of assets that
/// really exist so resolution has work to do rather than answering
/// `missing` immediately.
fn populate(root: &Path, copies: usize) {
    for copy in 0..copies {
        let package = root.join(format!("package-{copy}"));
        std::fs::create_dir_all(package.join("src")).expect("a directory");
        std::fs::create_dir_all(package.join("assets")).expect("a directory");

        for index in 0..FILES / 5 {
            std::fs::write(package.join(format!("assets/asset-{index}.txt")), "x")
                .expect("an asset");

            let neighbour = (index + 1) % (FILES / 5);
            std::fs::write(
                package.join(format!("src/module-{index}.ts")),
                format!(
                    "import './module-{neighbour}.ts';\n\
                     import '../assets/asset-{index}.txt';\n\
                     import './missing-{index}.ts';\n\
                     export const asset = '../assets/asset-{neighbour}.txt';\n"
                ),
            )
            .expect("a source file");

            std::fs::write(
                package.join(format!("src/config-{index}.json")),
                format!(
                    "{{\"main\":\"./module-{index}.ts\",\
                       \"asset\":\"../assets/asset-{index}.txt\",\
                       \"missing\":\"./gone-{index}.ts\"}}"
                ),
            )
            .expect("a config file");

            std::fs::write(
                package.join(format!("src/deploy-{index}.yml")),
                format!(
                    "steps:\n  - uses: ./module-{index}.ts\n  - path: ../assets/asset-{index}.txt\n"
                ),
            )
            .expect("a manifest");

            std::fs::write(
                package.join(format!("src/notes-{index}.md")),
                format!("See ./module-{index}.ts and ../assets/asset-{index}.txt.\n"),
            )
            .expect("a note");
        }

        // The shape that dominated a real scan: one document holding
        // thousands of paths, where the walk widening was felt.
        let mut lockfile = String::from("{\n  \"packages\": {\n");
        for index in 0..2_000 {
            writeln!(
                lockfile,
                "    \"node_modules/pkg-{index}\": {{ \"resolved\": \"./vendor/pkg-{index}.tgz\" }},"
            )
            .expect("a string grows");
        }
        lockfile.push_str("    \"\": {}\n  }\n}\n");
        std::fs::write(package.join("lock.json"), lockfile).expect("a lockfile");
    }
}

/// One timed run over a tree, and the number of paths it examined.
fn measure(root: &Path) -> (Duration, u64) {
    let started = Instant::now();
    let output = Command::new(BINARY)
        .args(["--strict", "--root"])
        .arg(root)
        .arg(root)
        .stdin(Stdio::null())
        .output()
        .expect("the binary runs");
    let elapsed = started.elapsed();

    let code = output.status.code().expect("an exit code, not a signal");
    assert!(
        (0..=1).contains(&code),
        "the tree must be examinable: exit {code}\n{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let paths = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let report: serde_json::Value =
                serde_json::from_str(line).expect("stdout carries only JSON");
            report["summary"]["paths"].as_u64().unwrap_or(0)
        })
        .sum();
    (elapsed, paths)
}

#[test]
fn a_five_hundred_file_tree_scans_inside_its_budget() {
    if !enabled("a_five_hundred_file_tree_scans_inside_its_budget") {
        return;
    }
    let tree = Tree::new("ceiling");
    populate(tree.path(), 1);

    let (elapsed, paths) = measure(tree.path());
    eprintln!("budget: {paths} paths in {elapsed:?} (ceiling {CEILING:?})");
    assert!(
        elapsed < CEILING,
        "the scan took {elapsed:?}, over the {CEILING:?} ceiling — \
         ten times the recorded local measurement. Something got an order \
         of magnitude slower, or the ceiling needs re-measuring with the \
         machine named in this file."
    );
    // A budget met by examining nothing is not a budget met. The tree
    // yields 3,000 paths as generated; the floor leaves room for the
    // heuristic to change its mind about a few of them without turning
    // this into a second corpus test.
    assert!(paths > 2_500, "only {paths} paths were examined");
}

/// The check that catches the quadratic class directly. Four times the
/// tree, no more than six times the clock.
#[test]
fn four_times_the_tree_does_not_cost_six_times_the_time() {
    if !enabled("four_times_the_tree_does_not_cost_six_times_the_time") {
        return;
    }
    let one = Tree::new("linear-one");
    populate(one.path(), 1);
    let four = Tree::new("linear-four");
    populate(four.path(), 4);

    // Once through each first: the first run of the pair would otherwise
    // pay for a cold page cache the second one does not.
    let _ = measure(one.path());
    let _ = measure(four.path());

    let (small, small_paths) = measure(one.path());
    let (large, large_paths) = measure(four.path());
    let ratio = large.as_secs_f64() / small.as_secs_f64().max(0.000_001);
    eprintln!(
        "linearity: {small_paths} paths in {small:?}, {large_paths} paths in {large:?} — {ratio:.2}×"
    );

    assert!(
        large_paths > small_paths * 3,
        "the larger tree must actually be larger: {small_paths} then {large_paths}"
    );
    assert!(
        ratio < LINEARITY,
        "four times the tree cost {ratio:.2}× the time, over the {LINEARITY}× \
         bound — that is the shape of an algorithm that is not linear in the \
         size of what it reads"
    );
}
