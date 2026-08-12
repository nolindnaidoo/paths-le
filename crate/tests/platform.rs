//! Behaviour that differs by operating system, asserted rather than
//! hoped for. Runs on macOS, Windows and Linux.
//!
//! Two of these exist because of a bug that shipped. envsync-le spelled
//! every path in its report with `\` on Windows for a whole release,
//! because the only machine that could see it was the only machine
//! nothing asserted on. And a stdin test once wrote to a child that had
//! already refused and exited, which is a race that fails one run in
//! twenty and gets rerun rather than read.
//!
//! Everything here runs against the built binary: what the operating
//! system does to a path is not observable from a unit test that never
//! leaves the process.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};

const BINARY: &str = env!("CARGO_BIN_EXE_paths-le");
static COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Say plainly what this platform could not express.
fn skip(case: &str, why: &str) {
    eprintln!("SKIPPED {case}: {why}");
}

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str) -> Self {
        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "paths-le-platform-{name}-{}-{unique}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("a temporary directory");
        Self {
            root: std::fs::canonicalize(&root).expect("a canonical directory"),
        }
    }

    fn path(&self) -> &Path {
        &self.root
    }

    fn write(&self, relative: &str, contents: &str) -> PathBuf {
        let target = self.root.join(relative);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).expect("a parent directory");
        }
        std::fs::write(&target, contents).expect("a file");
        target
    }
}

impl Drop for Tree {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

/// Raw stdout, so two runs can be compared byte for byte.
fn stdout_of(args: &[&str], tz: Option<&str>) -> String {
    let mut command = Command::new(BINARY);
    command.args(args).stdin(Stdio::null());
    match tz {
        Some(value) => command.env("TZ", value),
        None => command.env_remove("TZ"),
    };
    let output = command.output().expect("the binary runs");
    assert!(
        output.status.code().is_some(),
        "paths-le {args:?} was killed by a signal: {}",
        output.status
    );
    String::from_utf8_lossy(&output.stdout).into_owned()
}

fn reports(args: &[&str]) -> Vec<serde_json::Value> {
    stdout_of(args, Some("UTC"))
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("stdout carries only JSON"))
        .collect()
}

/// A tree deep enough that a separator has to appear in every reported
/// path, holding a live target, a missing one and (where the platform
/// allows) a symlink — so `file`, `canonical` and `symlink` are all
/// populated and all checkable.
fn separator_tree() -> Tree {
    let tree = Tree::new("separators");
    tree.write("src/nested/target.ts", "");
    tree.write(
        "src/nested/app.ts",
        "import './target.ts';\nimport './gone.ts';\n",
    );
    #[cfg(unix)]
    std::os::unix::fs::symlink("target.ts", tree.path().join("src/nested/link.ts"))
        .expect("a symlink");
    #[cfg(unix)]
    tree.write("src/nested/linked.ts", "import './link.ts';\n");
    tree
}

/// **Every path in the report uses `/`, on every platform.** A report is
/// a document somebody diffs against the same report taken on another
/// machine; a Windows run answering in `\` cannot be compared with a
/// Linux one, and neither matches the `/` the source it read was written
/// with.
#[test]
fn every_reported_path_spells_its_separators_forward() {
    let tree = separator_tree();
    let reports = reports(&[&tree.path().to_string_lossy()]);
    assert!(!reports.is_empty());

    let mut saw_separator = false;
    for report in &reports {
        let file = report["file"].as_str().expect("a file");
        assert!(!file.contains('\\'), "report path uses a backslash: {file}");
        saw_separator |= file.contains('/');

        for path in report["paths"].as_array().expect("paths") {
            for field in ["canonical", "symlink"] {
                let Some(value) = path["resolution"][field].as_str() else {
                    continue;
                };
                assert!(
                    !value.contains('\\'),
                    "resolution.{field} uses a backslash: {value}"
                );
            }
        }
    }
    assert!(
        saw_separator,
        "no reported path carried a separator at all, so this asserted nothing"
    );
}

/// **`TZ` independence.** Windows ignores the variable outright, so a
/// suite that depended on it would answer differently on one third of
/// the matrix. Nothing here reads a clock; this is what proves it.
#[test]
fn the_report_does_not_depend_on_the_time_zone() {
    let tree = separator_tree();
    let arguments = [tree.path().to_string_lossy().into_owned()];
    let arguments: Vec<&str> = arguments.iter().map(String::as_str).collect();

    let utc = stdout_of(&arguments, Some("UTC"));
    let unset = stdout_of(&arguments, None);
    let elsewhere = stdout_of(&arguments, Some("Pacific/Kiritimati"));
    assert!(!utc.is_empty());
    assert_eq!(utc, unset, "the report changed when TZ was unset");
    assert_eq!(utc, elsewhere, "the report changed with the time zone");
}

/// `README.md` and `readme.md` are one file on macOS and Windows and two
/// on Linux. Either answer is correct; reporting one file twice is not.
#[test]
fn a_case_folding_filesystem_does_not_report_one_file_twice() {
    let tree = Tree::new("case");
    tree.write("README.md", "see ./a.txt\n");
    let _ = std::fs::write(tree.path().join("readme.md"), "see ./b.txt\n");

    let on_disk = std::fs::read_dir(tree.path())
        .expect("the tree is readable")
        .count();
    let reports = reports(&[&tree.path().to_string_lossy()]);

    let mut files: Vec<&str> = reports
        .iter()
        .map(|report| report["file"].as_str().expect("a file"))
        .collect();
    let seen = files.len();
    files.sort_unstable();
    files.dedup();
    assert_eq!(files.len(), seen, "a file was reported twice: {files:?}");
    assert_eq!(
        seen, on_disk,
        "the walk and the directory disagree on how many files there are"
    );
}

/// `CON`, `PRN`, `AUX`, `NUL` and `COM1` are device names on Windows, so
/// creating them fails there and succeeds everywhere else. **The walk
/// must survive the failure**, which is why this asserts on the run and
/// not on the files existing.
#[test]
fn reserved_windows_device_names_do_not_break_the_walk() {
    let tree = Tree::new("reserved");
    tree.write("ordinary.json", "{\"a\":\"./t.txt\"}");
    tree.write("t.txt", "");

    let mut created = Vec::new();
    for name in ["CON", "PRN", "AUX", "NUL", "COM1"] {
        match std::fs::write(tree.path().join(name), "{\"a\":\"./t.txt\"}") {
            Ok(()) => created.push(name),
            Err(_) => skip(
                "reserved_windows_device_names_do_not_break_the_walk",
                &format!("{name} is a reserved device name on this platform"),
            ),
        }
    }

    let reports = reports(&[&tree.path().to_string_lossy()]);
    assert!(
        reports.iter().any(|report| report["file"]
            .as_str()
            .is_some_and(|f| f.ends_with("ordinary.json"))),
        "the ordinary file was lost alongside the reserved ones"
    );
    for name in created {
        assert!(
            reports
                .iter()
                .any(|report| report["file"].as_str().is_some_and(|f| f.ends_with(name))),
            "{name} was created and then not examined"
        );
    }
}

/// **Assert the exit code, never the write.** The child refuses before it
/// reads a byte, so by the time the parent writes, the pipe may already
/// be closed — and a test that unwraps that write is red for a reason
/// that has nothing to do with the tool. This cost a CI run once.
#[test]
fn a_child_that_refuses_before_reading_stdin_still_exits_two() {
    for arguments in [vec!["--stdin"], vec!["--stdin", "--format"]] {
        let mut child = Command::new(BINARY)
            .args(&arguments)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("the binary runs");
        // Deliberately ignored: EPIPE here is the child having already
        // answered, which is the behaviour under test.
        let _ = child
            .stdin
            .as_mut()
            .expect("stdin")
            .write_all(&b"{}".repeat(4096));
        drop(child.stdin.take());

        let output = child.wait_with_output().expect("the run finishes");
        assert_eq!(
            output.status.code(),
            Some(2),
            "paths-le {arguments:?} must refuse a question it cannot answer"
        );
    }
}

/// A document handed over on stdin has no directory of its own, so its
/// label is the same on every platform rather than a working directory
/// spelled three different ways.
#[test]
fn a_stdin_report_is_labelled_the_same_everywhere() {
    let mut child = Command::new(BINARY)
        .args(["--stdin", "--format", "json", "--no-resolve"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the binary runs");
    let written = child
        .stdin
        .as_mut()
        .expect("stdin")
        .write_all(b"{\"a\":\"./x.txt\"}");
    drop(child.stdin.take());
    let output = child.wait_with_output().expect("the run finishes");

    assert!(written.is_ok(), "the child closed stdin before reading it");
    assert_eq!(output.status.code(), Some(0));
    let report: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout carries JSON");
    assert_eq!(report["file"], "<stdin>");
    assert_eq!(report["paths"][0]["value"], "./x.txt");
}
