//! The tier that needs a real filesystem doing real filesystem things:
//! links that loop, directories that cannot be read, and the
//! case-sensitivity of whatever this machine actually runs.
//!
//! Gated behind `PATHS_LE_SCENARIOS` and run by CI on macOS, Windows
//! and Linux, because the answers differ per platform and none of them
//! can be reasoned out from the code. Nothing here is a substitute for
//! `contracts.rs` — that tier runs everywhere on every push.
//!
//! **A skipped scenario is never reported as a pass.** Each test says
//! plainly that it did not run.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

const BINARY: &str = env!("CARGO_BIN_EXE_paths-le");
static COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Returns false and says so when the gate is closed.
fn enabled(name: &str) -> bool {
    if std::env::var_os("PATHS_LE_SCENARIOS").is_some() {
        return true;
    }
    eprintln!("SKIPPED {name}: set PATHS_LE_SCENARIOS to run it");
    false
}

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str) -> Self {
        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "paths-le-scenario-{name}-{}-{unique}",
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
        // Best effort: a scenario may have left a directory this process
        // deliberately cannot read.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(entries) = std::fs::read_dir(&self.root) {
                for entry in entries.flatten() {
                    let _ = std::fs::set_permissions(
                        entry.path(),
                        std::fs::Permissions::from_mode(0o755),
                    );
                }
            }
        }
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn audit(args: &[&str]) -> (i32, Vec<serde_json::Value>, String) {
    let output = Command::new(BINARY)
        .args(args)
        .output()
        .expect("the binary runs");
    let reports = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("stdout carries only JSON"))
        .collect();
    (
        output.status.code().expect("an exit code"),
        reports,
        String::from_utf8_lossy(&output.stderr).into_owned(),
    )
}

/// A symlink cycle makes `canonicalize` fail with a loop error rather
/// than a not-found. The tool must still answer — a hang or a panic
/// here would take out a whole CI run over one bad link.
#[cfg(unix)]
#[test]
fn a_symlink_loop_is_answered_not_hung() {
    if !enabled("a_symlink_loop_is_answered_not_hung") {
        return;
    }
    let tree = Tree::new("loop");
    std::os::unix::fs::symlink("b.txt", tree.path().join("a.txt")).expect("a symlink");
    std::os::unix::fs::symlink("a.txt", tree.path().join("b.txt")).expect("a symlink");
    tree.write("app.json", "{\"a\":\"./a.txt\"}");

    let (code, reports, _) = audit(&[&tree.path().to_string_lossy()]);
    assert_eq!(code, 1, "a loop is a finding, not a crash");
    let verdict = &reports
        .iter()
        .find(|report| {
            report["file"]
                .as_str()
                .is_some_and(|f| f.ends_with("app.json"))
        })
        .expect("the report")["paths"][0]["resolution"]["verdict"];
    assert_eq!(verdict, "missing");
}

/// A directory the process cannot enter must be reported, not skipped.
/// An audit that silently omitted it would claim coverage it does not
/// have — which is the failure mode this whole tool exists to avoid.
#[cfg(unix)]
#[test]
fn an_unreadable_directory_is_reported() {
    use std::os::unix::fs::PermissionsExt;

    if !enabled("an_unreadable_directory_is_reported") {
        return;
    }

    let tree = Tree::new("locked");
    tree.write("open/a.json", "{}");
    let locked = tree.path().join("locked");
    std::fs::create_dir_all(&locked).expect("a directory");
    std::fs::write(locked.join("b.json"), "{}").expect("a file");
    std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o000)).expect("permissions");

    let (code, _, stderr) = audit(&[&tree.path().to_string_lossy()]);

    std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o755)).expect("permissions");

    assert_eq!(code, 2, "an unwalkable directory means it could not answer");
    assert!(
        stderr.contains("locked") || stderr.contains("ermission"),
        "the refusal must name what it could not read: {stderr}"
    );
}

/// Whether `./README.MD` resolves to `README.md` is the filesystem's
/// answer, not this tool's — macOS and Windows say yes by default,
/// Linux says no. The tool must report whatever the machine does,
/// rather than normalising case and inventing an answer.
#[test]
fn case_sensitivity_follows_the_filesystem() {
    if !enabled("case_sensitivity_follows_the_filesystem") {
        return;
    }
    let tree = Tree::new("case");
    tree.write("Target.ts", "");
    tree.write("app.ts", "import './target.ts';\n");

    let (code, reports, _) = audit(&[&tree.path().to_string_lossy()]);
    let verdict = reports
        .iter()
        .find(|report| {
            report["file"]
                .as_str()
                .is_some_and(|f| f.ends_with("app.ts"))
        })
        .expect("the report")["paths"][0]["resolution"]["verdict"]
        .as_str()
        .expect("a verdict")
        .to_string();

    let insensitive = std::fs::metadata(tree.path().join("TARGET.TS")).is_ok();
    if insensitive {
        assert_eq!(verdict, "ok", "this filesystem is case-insensitive");
        assert_eq!(code, 0);
    } else {
        assert_eq!(verdict, "missing", "this filesystem is case-sensitive");
        assert_eq!(code, 1);
    }
}

/// A tree walked without following links must report the link and stop,
/// rather than descending into it and auditing the same files twice
/// under two names.
#[cfg(unix)]
#[test]
fn a_linked_directory_is_not_descended_by_default() {
    if !enabled("a_linked_directory_is_not_descended_by_default") {
        return;
    }
    let tree = Tree::new("descend");
    tree.write("real/a.json", "{}");
    std::os::unix::fs::symlink("real", tree.path().join("alias")).expect("a symlink");

    let (_, default, _) = audit(&[&tree.path().to_string_lossy()]);
    assert_eq!(default.len(), 1, "the link was descended: {default:?}");

    let (_, followed, _) = audit(&["--follow-symlinks", &tree.path().to_string_lossy()]);
    assert_eq!(followed.len(), 2, "the link was not followed: {followed:?}");
}
