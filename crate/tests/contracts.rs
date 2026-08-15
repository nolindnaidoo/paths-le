//! The exit codes and the stdout contract, driven against the built
//! binary.
//!
//! These are the API: a script branches on the exit code and parses
//! stdout, so both are pinned here rather than inferred from unit
//! tests of the functions behind them. Nothing here needs a network, a
//! browser or a privileged filesystem operation, so it runs everywhere
//! on every push.
//!
//! A new refusal adds its case here.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};

const BINARY: &str = env!("CARGO_BIN_EXE_paths-le");
static COUNTER: AtomicUsize = AtomicUsize::new(0);

struct Tree {
    root: PathBuf,
}

impl Tree {
    fn new(name: &str) -> Self {
        let unique = COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "paths-le-contract-{name}-{}-{unique}",
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

struct Run {
    code: i32,
    stdout: String,
    stderr: String,
}

fn run(args: &[&str]) -> Run {
    let output = Command::new(BINARY)
        .args(args)
        .output()
        .expect("the binary runs");
    Run {
        code: output.status.code().expect("an exit code"),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    }
}

/// Every line of stdout, parsed. Doubles as the assertion that stdout
/// is JSON Lines and nothing else — a stray human message there would
/// fail to parse.
fn reports(run: &Run) -> Vec<serde_json::Value> {
    run.stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("stdout carries only JSON"))
        .collect()
}

/// The same run, from inside a directory — the only way to hand the
/// binary an argument with no directory component, which is what a
/// person types.
fn run_in(dir: &Path, args: &[&str]) -> Run {
    let output = Command::new(BINARY)
        .args(args)
        .current_dir(dir)
        .output()
        .expect("the binary runs");
    Run {
        code: output.status.code().expect("an exit code"),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    }
}

/// `paths-le a.yaml` — a filename with no directory in front of it.
///
/// It exited 2 with an error naming no file, because the root came from
/// `Path::parent`, which answers `Some("")` here rather than `None`.
/// Every other test in this file names its files by absolute path, so
/// none of them could reach it.
#[test]
fn a_bare_filename_argument_is_audited_like_any_other() {
    let tree = Tree::new("bare-name");
    tree.write("bin/server.js", "");
    tree.write(
        "deploy.yaml",
        "entrypoint: ./bin/server.js\nmissing: ./bin/gone.js\n",
    );
    let run = run_in(tree.path(), &["deploy.yaml"]);
    assert_eq!(run.code, 1, "{}", run.stderr);

    // And the two paths must be told apart. Against an empty base every
    // relative path resolved outside the root, so the file that was
    // there and the file that was not came back with one verdict.
    let paths = &reports(&run)[0]["paths"];
    assert_eq!(paths[0]["resolution"]["verdict"], "ok", "{paths:?}");
    assert_eq!(paths[1]["resolution"]["verdict"], "missing", "{paths:?}");
}

#[test]
fn a_tree_whose_paths_all_resolve_exits_clear() {
    let tree = Tree::new("clean");
    tree.write("src/helper.ts", "");
    tree.write("src/app.ts", "import './helper.ts';\n");
    let run = run(&[&tree.path().to_string_lossy()]);
    assert_eq!(run.code, 0, "{}", run.stderr);
    // One report per file examined, including the file that happened to
    // contain no paths — silence about it would be indistinguishable
    // from never having looked.
    let reports = reports(&run);
    assert_eq!(reports.len(), 2);
    assert!(
        reports
            .iter()
            .all(|report| report["summary"]["findings"] == 0),
        "{reports:?}"
    );
}

#[test]
fn a_missing_path_exits_one() {
    let tree = Tree::new("missing");
    tree.write("src/app.ts", "import './gone.ts';\n");
    let run = run(&[&tree.path().to_string_lossy()]);
    assert_eq!(run.code, 1);
    let reports = reports(&run);
    assert_eq!(reports[0]["summary"]["findings"], 1);
    assert_eq!(reports[0]["paths"][0]["resolution"]["verdict"], "missing");
}

#[test]
fn a_path_climbing_out_of_the_tree_exits_one() {
    let tree = Tree::new("escape");
    tree.write("src/app.ts", "import '../../../../etc/passwd';\n");
    let run = run(&[&tree.path().to_string_lossy()]);
    assert_eq!(run.code, 1);
    assert_eq!(
        reports(&run)[0]["paths"][0]["resolution"]["verdict"],
        "escapes-root"
    );
}

/// Exit 1 is the tool answering "no". Only exit 2 means it could not
/// answer, and the difference is what a CI step branches on.
#[test]
fn an_unknown_flag_exits_two_and_names_itself() {
    let tree = Tree::new("badflag");
    let run = run(&["--stict", &tree.path().to_string_lossy()]);
    assert_eq!(run.code, 2);
    assert!(run.stderr.contains("--stict"), "{}", run.stderr);
    assert!(run.stdout.is_empty(), "a refusal writes no report");
}

#[test]
fn a_path_that_does_not_exist_exits_two() {
    let run = run(&["/no/such/place-xyz"]);
    assert_eq!(run.code, 2);
    assert!(run.stdout.is_empty());
}

#[test]
fn naming_nothing_exits_two() {
    let run = run(&[]);
    assert_eq!(run.code, 2);
}

#[test]
fn a_flag_without_its_value_exits_two() {
    let run = run(&["--root"]);
    assert_eq!(run.code, 2);
}

/// A file that cannot be read means the audit does not cover it, so it
/// is named — but it does not fail the run by itself. Every repository
/// has one, and exiting 2 on it meant the tool never got run in CI at
/// all, which is where an audit is worth the most. `--strict` is there
/// for a pipeline that wants zero tolerance.
#[test]
fn an_unreadable_file_is_named_and_does_not_end_the_run() {
    let tree = Tree::new("unreadable");
    // No NUL byte: this is a text candidate that could not be read, not
    // a binary file. The distinction is pinned by the test below.
    std::fs::write(tree.path().join("broken.json"), [0xff, 0xfe, 0x41]).expect("a file");
    let lenient = run(&[&tree.path().to_string_lossy()]);
    assert_eq!(lenient.code, 0);
    // The report still lands on stdout: the caller learns which file.
    assert_eq!(reports(&lenient)[0]["diagnostics"][0]["code"], "skipped");
    assert_eq!(
        reports(&lenient)[0]["diagnostics"][0]["message"],
        "not UTF-8 text"
    );

    let strict = run(&["--strict", &tree.path().to_string_lossy()]);
    assert_eq!(strict.code, 2);
}

/// A binary file is not a skipped file, and `--strict` is where the
/// difference shows. Widening the walk brought every PNG in a repository
/// into the reader; reporting each as skipped made `--strict` exit 2 on
/// any tree holding an image, which is every tree.
#[test]
fn a_binary_file_is_skipped_silently_and_does_not_fail_strict() {
    let tree = Tree::new("binary");
    tree.write("app.json", "{\"a\":\"./there.ts\"}");
    tree.write("there.ts", "");
    std::fs::write(
        tree.path().join("logo.png"),
        [0x89, b'P', b'N', b'G', 0x00, 0x1a],
    )
    .expect("a file");

    let lenient = run(&[&tree.path().to_string_lossy()]);
    assert_eq!(lenient.code, 0);
    let files: Vec<String> = reports(&lenient)
        .iter()
        .map(|report| report["file"].as_str().expect("a file").to_string())
        .collect();
    assert_eq!(files.len(), 2, "{files:?}");
    assert!(
        files.iter().all(|file| !file.ends_with("logo.png")),
        "{files:?}"
    );
    // Counted rather than listed: coverage narrower than the tree is
    // said out loud, or the tally reads as coverage it does not have.
    assert!(
        lenient.stderr.contains("1 binary files skipped"),
        "{}",
        lenient.stderr
    );

    let strict = run(&["--strict", &tree.path().to_string_lossy()]);
    assert_eq!(strict.code, 0, "a binary file is not a strict failure");
}

#[test]
fn without_resolution_a_broken_tree_still_exits_clear() {
    let tree = Tree::new("noresolve");
    tree.write("src/app.ts", "import './gone.ts';\n");
    let run = run(&["--no-resolve", &tree.path().to_string_lossy()]);
    assert_eq!(run.code, 0);
    let reports = reports(&run);
    assert_eq!(
        reports[0]["paths"][0]["resolution"]["verdict"],
        "unresolved"
    );
    assert!(run.stderr.contains("not resolved"), "{}", run.stderr);
}

/// Canonicalisation is the audit, so it counts without being asked for.
#[test]
fn a_non_canonical_path_fails_the_run_by_default() {
    let tree = Tree::new("canon");
    tree.write("src/helper.ts", "");
    tree.write("src/app.ts", "import './/helper.ts';\n");
    assert_eq!(run(&[&tree.path().to_string_lossy()]).code, 1);
}

/// A link is a fact until asked about — and asking is the point of a
/// symlink audit, so the flag has to reach the exit code.
#[cfg(unix)]
#[test]
fn a_symlink_fails_the_run_only_when_denied() {
    let tree = Tree::new("denylinks");
    tree.write("src/real.ts", "");
    std::os::unix::fs::symlink("real.ts", tree.path().join("src/link.ts")).expect("a symlink");
    tree.write("src/app.ts", "import './link.ts';\n");

    let quiet = run(&[&tree.path().to_string_lossy()]);
    assert_eq!(quiet.code, 0, "{}", quiet.stderr);
    let denied = run(&["--deny-symlinks", &tree.path().to_string_lossy()]);
    assert_eq!(denied.code, 1, "{}", denied.stderr);
}

/// The monorepo case, end to end: a cross-package import is not an
/// escape when the repository is the root.
#[test]
fn a_cross_package_import_is_not_an_escape_inside_a_repository() {
    let tree = Tree::new("monorepo");
    std::fs::create_dir_all(tree.path().join(".git")).expect("a git dir");
    tree.write("packages/shared/logger.ts", "");
    tree.write("packages/app/index.ts", "import '../shared/logger.ts';\n");
    let run = run(&[&tree.path().join("packages/app").to_string_lossy()]);
    assert_eq!(run.code, 0, "{}", run.stderr);
}

#[test]
fn the_worst_outcome_in_a_run_is_the_exit_code() {
    let tree = Tree::new("worst");
    tree.write("ok.json", "{}");
    tree.write("bad.json", "{\"a\":\"./gone.ts\"}");
    let run = run(&[&tree.path().to_string_lossy()]);
    assert_eq!(run.code, 1);
    assert_eq!(reports(&run).len(), 2);
}

#[test]
fn version_and_help_exit_clear() {
    let version = run(&["--version"]);
    assert_eq!(version.code, 0);
    assert!(version.stdout.contains("paths-le"));

    let help = run(&["--help"]);
    assert_eq!(help.code, 0);
    assert!(help.stdout.contains("usage: paths-le"));
}

/// stdout is protocol and stderr is human. A report on stderr or a
/// sentence on stdout would break every caller that pipes one of them.
#[test]
fn stdout_carries_only_reports_and_stderr_only_the_summary() {
    let tree = Tree::new("streams");
    tree.write("a.json", "{\"a\":\"./gone.ts\"}");
    let run = run(&[&tree.path().to_string_lossy()]);
    let reports = reports(&run);
    assert_eq!(reports.len(), 1);
    assert!(!run.stderr.contains('{'), "{}", run.stderr);
    assert!(run.stderr.contains("1 file"), "{}", run.stderr);
}

#[test]
fn a_document_on_stdin_is_audited_against_the_working_directory() {
    let mut child = Command::new(BINARY)
        .args(["--stdin", "--format", "json", "--no-resolve"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the binary runs");
    child
        .stdin
        .as_mut()
        .expect("stdin")
        .write_all(b"{\"a\":\"./x.txt\"}")
        .expect("the document is written");
    let output = child.wait_with_output().expect("the run finishes");

    assert_eq!(output.status.code(), Some(0));
    let report: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout carries JSON");
    assert_eq!(report["file"], "<stdin>");
    assert_eq!(report["paths"][0]["value"], "./x.txt");
}

#[test]
fn stdin_without_a_format_exits_two() {
    let mut child = Command::new(BINARY)
        .args(["--stdin"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the binary runs");
    // The child refuses before it ever reads stdin, so it can be gone
    // before this write lands and the pipe closes underneath it. Whether
    // that happens is a race between two processes, and on Linux it does:
    // asserting the write turned a correct refusal into a red build with
    // "Broken pipe". The exit code is the contract; the write is not.
    let _ = child.stdin.as_mut().expect("stdin").write_all(b"{}");
    let output = child.wait_with_output().expect("the run finishes");
    assert_eq!(output.status.code(), Some(2));
}

/// **The cross-surface contract.** Both surfaces call one entry point,
/// so they must answer identically for the same tree. A surface that
/// grows its own copy of a rule fails here.
#[test]
fn the_cli_and_the_mcp_server_report_the_same_thing() {
    let tree = Tree::new("agreement");
    tree.write("src/helper.ts", "");
    tree.write("src/app.ts", "import './helper.ts';\nimport './gone.ts';\n");
    tree.write("pkg.json", "{\"main\":\"./src/app.ts\"}");

    let cli = run(&[&tree.path().to_string_lossy()]);
    let from_cli = reports(&cli);

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "paths_le_audit",
            "arguments": { "path": tree.path().to_string_lossy() },
        },
    });
    let mut child = Command::new(BINARY)
        .arg("mcp")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("the server starts");
    writeln!(child.stdin.as_mut().expect("stdin"), "{request}").expect("the request is written");
    let output = child.wait_with_output().expect("the server finishes");
    let response: serde_json::Value = serde_json::from_slice(
        output
            .stdout
            .split(|byte| *byte == b'\n')
            .next()
            .expect("a line"),
    )
    .expect("the reply is JSON");

    let from_mcp = response["result"]["structuredContent"]["data"]["reports"]
        .as_array()
        .expect("reports")
        .clone();

    assert_eq!(from_mcp, from_cli, "the two surfaces disagree");
}
