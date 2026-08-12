//! Documents and directory entries that are hostile to a reader, run
//! against the built binary on macOS, Windows and Linux.
//!
//! Every bug this file exists for was found by hand on a crafted tree
//! rather than by a test: a byte-order mark read as content emptied
//! three crates silently, a PNG made the whole run exit 2, and a file
//! that was text but undecodable vanished from the report entirely —
//! which reads, to whoever ran it, as a file that was clean.
//!
//! **The tree is built at runtime, not checked in.** Windows cannot hold
//! a FIFO, a mode-000 file or (without opt-in) a path over 260
//! characters, and a fixture directory that cannot be created on a third
//! of the matrix is a fixture directory that silently tests nothing. So
//! each case that a platform cannot express says so by name — see
//! `skip()` — and a skipped case is never reported as a pass.
//!
//! Every case asserts the same three things before anything specific:
//! the process does not panic, does not hang, and exits 0, 1 or 2 —
//! never a signal.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

const BINARY: &str = env!("CARGO_BIN_EXE_paths-le");
static COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Long enough that a shared runner under load does not fail the build,
/// short enough that a real hang is caught in this job rather than by
/// the workflow's own timeout twenty minutes later.
const LIMIT: Duration = Duration::from_secs(60);

/// The value every hazardous document carries, so "did it survive" and
/// "did it still read the document" are two separate answers.
const VALUE: &str = "./t.txt";

/// Say plainly what this platform could not express. A silent pass here
/// would be the test claiming coverage the run does not have, which is
/// the same failure this whole tool exists to report on.
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
            "paths-le-hazard-{name}-{}-{unique}",
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

    fn write(&self, relative: &str, bytes: &[u8]) -> PathBuf {
        let target = self.root.join(relative);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).expect("a parent directory");
        }
        std::fs::write(&target, bytes).expect("a file");
        target
    }
}

impl Drop for Tree {
    fn drop(&mut self) {
        // A case may have left a file this process deliberately cannot
        // read; make it removable again before the tree goes.
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

struct Run {
    code: i32,
    reports: Vec<serde_json::Value>,
    stderr: String,
}

impl Run {
    /// The report for a file, by the name it ends with. Report paths
    /// spell their separators forward on every platform, which is why
    /// this can compare a plain suffix.
    fn report(&self, name: &str) -> Option<&serde_json::Value> {
        self.reports.iter().find(|report| {
            report["file"]
                .as_str()
                .is_some_and(|file| file.ends_with(name))
        })
    }

    fn values(&self, name: &str) -> Vec<String> {
        self.report(name)
            .and_then(|report| report["paths"].as_array())
            .map(|paths| {
                paths
                    .iter()
                    .filter_map(|path| path["value"].as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default()
    }
}

/// Run the binary and refuse to wait forever.
///
/// A hang is the failure mode a crafted tree produces most often — a
/// FIFO nobody writes to, a symlink cycle — and a test that waits for a
/// hung child reports it as a twenty-minute CI timeout with no name
/// attached. This one names the arguments.
fn run(args: &[&str]) -> Run {
    let started = Instant::now();
    let mut child = Command::new(BINARY)
        .args(args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .expect("the binary runs");

    while started.elapsed() < LIMIT {
        if child.try_wait().expect("the child is waitable").is_some() {
            break;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    if child.try_wait().expect("the child is waitable").is_none() {
        let _ = child.kill();
        let _ = child.wait();
        panic!("paths-le {args:?} did not finish within {LIMIT:?}");
    }

    let output = child.wait_with_output().expect("the run finishes");
    // `code()` is None when a signal ended the process. SIGABRT from a
    // slice on a character boundary is exactly the bug this catches, and
    // it is invisible to any assertion made on stdout.
    let code = output.status.code().unwrap_or_else(|| {
        panic!(
            "paths-le {args:?} was killed by a signal: {}",
            output.status
        )
    });
    assert!(
        (0..=2).contains(&code),
        "paths-le {args:?} exited {code}; the contract is 0, 1 or 2"
    );

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let reports = stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("stdout carries only JSON"))
        .collect();
    Run {
        code,
        reports,
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    }
}

/// A JSON document holding `VALUE`, with `lead` in front of the key.
fn document(lead: &str) -> String {
    format!("{{{lead}\"a\":\"{VALUE}\"}}")
}

/// The content hazards, each named so a failure says which byte
/// sequence broke it.
fn content_tree() -> Tree {
    let tree = Tree::new("content");
    // The value every document points at, so a survivable document is
    // also a clean one and the exit code stays readable.
    tree.write("t.txt", b"");

    tree.write("bom.json", format!("\u{feff}{}", document("")).as_bytes());
    tree.write("crlf.json", document("\r\n").as_bytes());
    tree.write("cr.json", document("\r").as_bytes());
    tree.write("notrail.json", document("").as_bytes());
    tree.write("empty.json", b"");
    tree.write("blank.json", b"   \n\t  \n");
    // A NUL in the first 8KB is ripgrep's binary heuristic, so this file
    // was never a text candidate: no report line, no effect on --strict.
    tree.write("nul.json", b"{\"a\":\"./t.txt\"}\0trailing");
    // Text with no NUL that is nonetheless not decodable: a lone 0xff is
    // not valid UTF-8 anywhere. This one must be *named*, not dropped.
    let mut invalid = document("").into_bytes();
    invalid.extend_from_slice(&[0xff, 0xfe]);
    tree.write("invalid.json", &invalid);
    // UTF-16LE with its own BOM: every ASCII character brings a NUL, so
    // the binary sniff catches it in the first two bytes.
    let mut utf16 = vec![0xff, 0xfe];
    for unit in document("").encode_utf16() {
        utf16.extend_from_slice(&unit.to_le_bytes());
    }
    tree.write("utf16.json", &utf16);
    // Four bytes, two UTF-16 code units, one column pair — before the
    // value, so a byte-counted column answers differently here.
    tree.write("emoji.json", document("\"\u{1f3af}\":1,").as_bytes());
    tree.write(
        "longline.json",
        document(&format!("\"pad\":\"{}\",", "x".repeat(1_000_000))).as_bytes(),
    );
    // Markdown reads by the generic scan, which is the layer a hundred
    // thousand lines actually exercises.
    let mut many = "# note\n".repeat(100_000);
    many.push_str("see ./t.txt\n");
    tree.write("manylines.md", many.as_bytes());
    tree
}

#[test]
fn every_content_hazard_is_survived_and_read() {
    let tree = content_tree();
    let run = run(&[&tree.path().to_string_lossy()]);
    assert_eq!(run.code, 0, "{}", run.stderr);

    // Read, not merely survived: each of these still yields the value.
    for name in [
        "bom.json",
        "crlf.json",
        "cr.json",
        "notrail.json",
        "emoji.json",
        "longline.json",
        "manylines.md",
    ] {
        assert!(
            run.values(name).iter().any(|value| value == VALUE),
            "{name} produced {:?}",
            run.values(name)
        );
    }

    // A document with nothing in it is still a document that was looked
    // at, so it gets a line saying so.
    for name in ["empty.json", "blank.json"] {
        assert!(run.report(name).is_some(), "{name} produced no report line");
        assert!(run.values(name).is_empty(), "{name}");
    }
}

/// Three invisible bytes that Notepad, Excel and a PowerShell redirect
/// all add. VS Code strips them before the extension sees a document, so
/// leaving them in means the two frontends read the same file
/// differently — and in a structured format the parser rejects the whole
/// document, which is indistinguishable from a file with no paths in it.
#[test]
fn a_byte_order_mark_does_not_move_the_reported_column() {
    let tree = Tree::new("bom-column");
    tree.write("t.txt", b"");
    tree.write("without.json", document("").as_bytes());
    tree.write("with.json", format!("\u{feff}{}", document("")).as_bytes());

    let run = run(&[&tree.path().to_string_lossy()]);
    let column = |name: &str| {
        run.report(name).expect("a report line")["paths"][0]["column"]
            .as_u64()
            .expect("a column")
    };
    assert_eq!(column("with.json"), column("without.json"));
}

/// **A binary file is not a skipped file**, and `--strict` is where the
/// difference shows. Reporting a PNG as skipped made `--strict` exit 2
/// on every repository holding an image, which is every repository.
#[test]
fn a_binary_file_produces_no_line_and_does_not_move_strict() {
    let tree = Tree::new("binary");
    tree.write("t.txt", b"");
    tree.write("app.json", document("").as_bytes());
    tree.write("logo.png", &[0x89, b'P', b'N', b'G', 0x00, 0x1a]);
    let mut utf16 = vec![0xff, 0xfe];
    for unit in "x".encode_utf16() {
        utf16.extend_from_slice(&unit.to_le_bytes());
    }
    tree.write("wide.txt", &utf16);

    let lenient = run(&[&tree.path().to_string_lossy()]);
    assert_eq!(lenient.code, 0, "{}", lenient.stderr);
    for name in ["logo.png", "wide.txt"] {
        assert!(
            lenient.report(name).is_none(),
            "{name} should have no report line"
        );
    }
    assert!(
        lenient.stderr.contains("2 binary files skipped"),
        "counted rather than listed: {}",
        lenient.stderr
    );

    let strict = run(&["--strict", &tree.path().to_string_lossy()]);
    assert_eq!(strict.code, 0, "a binary file is not a strict failure");
}

/// The third option is the one never allowed: a text file that silently
/// vanishes from the report, which reads to whoever ran it as a file
/// that was clean.
#[test]
fn a_text_file_that_cannot_be_decoded_is_named_and_fails_strict() {
    let tree = Tree::new("undecodable");
    let mut invalid = document("").into_bytes();
    invalid.extend_from_slice(&[0xff, 0xfe]);
    tree.write("broken.json", &invalid);

    let lenient = run(&[&tree.path().to_string_lossy()]);
    assert_eq!(lenient.code, 0, "{}", lenient.stderr);
    let report = lenient.report("broken.json").expect("a report line");
    assert_eq!(report["diagnostics"][0]["code"], "skipped");
    assert_eq!(report["diagnostics"][0]["message"], "not UTF-8 text");

    let strict = run(&["--strict", &tree.path().to_string_lossy()]);
    assert_eq!(strict.code, 2);
}

/// Exit 2 means the *question* was malformed. It does not mean one file
/// in fifty thousand could not be opened — that distinction is what
/// decides whether this tool ever gets run in CI at all.
#[test]
fn only_a_malformed_question_exits_two() {
    let tree = Tree::new("question");
    tree.write("t.txt", b"");
    tree.write("app.json", document("").as_bytes());

    assert_eq!(run(&["--stict", &tree.path().to_string_lossy()]).code, 2);
    assert_eq!(run(&["--root"]).code, 2);
    assert_eq!(run(&[&tree.path().join("nope").to_string_lossy()]).code, 2);
    assert_eq!(run(&[&tree.path().to_string_lossy()]).code, 0);

    // A file the process cannot open is not a malformed question.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let locked = tree.write("locked.json", document("").as_bytes());
        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o000))
            .expect("permissions");
        // root reads anything, so the case cannot be expressed there.
        let unreadable = std::fs::read(&locked).is_err();
        if !unreadable {
            skip(
                "an_unreadable_file_is_not_a_malformed_question",
                "this process can read a mode-000 file (running as root)",
            );
        }
        if unreadable {
            let lenient = run(&[&tree.path().to_string_lossy()]);
            assert_eq!(lenient.code, 0, "{}", lenient.stderr);
            assert_eq!(
                lenient.report("locked.json").expect("a report line")["diagnostics"][0]["code"],
                "skipped"
            );
            assert_eq!(run(&["--strict", &tree.path().to_string_lossy()]).code, 2);
        }
        let _ = std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o644));
    }
}

/// Names a filesystem accepts but a walker can trip over. Each is
/// created where the platform allows it and named where it does not.
#[test]
fn every_filesystem_hazard_is_survived() {
    let tree = Tree::new("filesystem");
    tree.write("t.txt", b"");
    tree.write("has space.json", document("").as_bytes());
    tree.write("\u{fc}n\u{ef}cod\u{e9}.json", document("").as_bytes());
    tree.write("\u{1f3af}.json", document("").as_bytes());
    // A directory that looks like a document. The walk yields files, so
    // this must contribute nothing rather than being opened.
    std::fs::create_dir_all(tree.path().join("x.json")).expect("a directory");

    let links = link_hazards(&tree);
    let fifo = fifo_hazard(&tree);
    let deep = deep_path_hazard(&tree);

    let run = run(&["--hidden", &tree.path().to_string_lossy()]);
    assert!(
        run.code == 0 || run.code == 1,
        "exit {} — {}",
        run.code,
        run.stderr
    );

    for name in [
        "has space.json",
        "\u{fc}n\u{ef}cod\u{e9}.json",
        "\u{1f3af}.json",
    ] {
        assert!(
            run.values(name).iter().any(|value| value == VALUE),
            "{name} produced {:?}",
            run.values(name)
        );
    }
    assert!(
        run.report("x.json").is_none(),
        "a directory named x.json is not a document"
    );
    if let Some(name) = fifo {
        assert!(
            run.report(&name).is_none(),
            "a FIFO is not a regular file and must never be opened for reading"
        );
    }
    if let Some(name) = deep {
        assert!(
            run.report(&name).is_some(),
            "a path over 260 characters was created and then not examined"
        );
    }
    if links {
        // The loop, the broken link and the live link are all reachable
        // as values; resolving them must answer rather than spin.
        let verdicts: Vec<&str> = run.report("links.json").expect("a report line")["paths"]
            .as_array()
            .expect("paths")
            .iter()
            .filter_map(|path| path["resolution"]["verdict"].as_str())
            .collect();
        assert_eq!(verdicts.len(), 3, "{verdicts:?}");
        assert!(
            verdicts.iter().all(|verdict| *verdict != "unresolved"),
            "{verdicts:?}"
        );
    }
}

/// A live link, a broken link and a two-step cycle, referenced from a
/// document so resolution has to survive all three. Returns false where
/// the platform will not make them.
fn link_hazards(tree: &Tree) -> bool {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink("t.txt", tree.path().join("live.txt")).expect("a symlink");
        std::os::unix::fs::symlink("gone.txt", tree.path().join("broken.txt")).expect("a symlink");
        std::os::unix::fs::symlink("loop-b.txt", tree.path().join("loop-a.txt"))
            .expect("a symlink");
        std::os::unix::fs::symlink("loop-a.txt", tree.path().join("loop-b.txt"))
            .expect("a symlink");
        tree.write(
            "links.json",
            br#"{"a":"./live.txt","b":"./broken.txt","c":"./loop-a.txt"}"#,
        );
        true
    }
    // Creating a symlink on Windows needs Developer Mode or an elevated
    // process, neither of which a test may assume. `scenarios.rs` covers
    // the same ground on the platforms that can express it.
    #[cfg(not(unix))]
    {
        let _ = tree;
        skip(
            "link_hazards",
            "this platform does not create symlinks without privilege",
        );
        false
    }
}

/// A named pipe with nobody on the other end. Reading it blocks forever,
/// so the walk must never treat it as a regular file — this is the case
/// that turns a hang into an assertion.
fn fifo_hazard(tree: &Tree) -> Option<String> {
    #[cfg(unix)]
    {
        let path = tree.path().join("pipe.json");
        let made = Command::new("mkfifo")
            .arg(&path)
            .status()
            .is_ok_and(|status| status.success());
        if !made {
            skip("fifo_hazard", "mkfifo is not available on this machine");
            return None;
        }
        Some("pipe.json".to_string())
    }
    #[cfg(not(unix))]
    {
        let _ = tree;
        skip("fifo_hazard", "this platform has no FIFO");
        None
    }
}

/// Over 260 characters, which is where Windows differs: the classic
/// `MAX_PATH` limit still applies to a process without long-path opt-in,
/// so creation is attempted and the failure is named rather than
/// asserted away.
fn deep_path_hazard(tree: &Tree) -> Option<String> {
    let mut nested = tree.path().to_path_buf();
    while nested.as_os_str().len() < 300 {
        nested.push("a-directory-with-a-long-name");
    }
    if std::fs::create_dir_all(&nested).is_err() {
        skip(
            "deep_path_hazard",
            "this platform refused a path over 260 characters (Windows MAX_PATH)",
        );
        return None;
    }
    let file = nested.join("deep.json");
    if std::fs::write(&file, document("")).is_err() {
        skip(
            "deep_path_hazard",
            "this platform refused a file at a path over 260 characters",
        );
        return None;
    }
    Some("deep.json".to_string())
}
