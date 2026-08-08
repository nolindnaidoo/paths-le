//! The terminal surface.
//!
//! stdout is always protocol — one JSON report per line, one line per
//! file. stderr is always for the human, and is a projection of the
//! same reports rather than parallel prose. Exit codes are the API:
//! 0 clear, 1 findings, 2 the question was malformed.

use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use crate::audit::{self, AuditOptions, FileReport};
use crate::extract::format::{SUPPORTED_FORMATS, resolve_format};
use crate::walk::{self, Target, WalkOptions};

const USAGE: &str = "usage: paths-le [options] <file|dir>...
       paths-le [options] --stdin --format <format>
       paths-le mcp
       paths-le --version | --help

Finds every file and directory path in a document and reports whether it
still points at anything. One JSON report per line on stdout, human
summary on stderr.

Options:
  --no-resolve         report paths as written; skip the filesystem
                       entirely. No path can then be a finding.
  --root <dir>         the boundary a relative path may not escape
                       (default: the enclosing git repository, else the
                       directory argument, else the working directory)
  --deny-symlinks      treat a symlink as a finding too (it is
                       reported either way)
  --format <format>    force a format instead of inferring it from the
                       file name; required with --stdin
  --stdin              read one document from stdin
  --follow-symlinks    resolve through symlinks when walking a tree
                       (default: report the link, do not descend it)
  --hidden             walk hidden files and directories too
  --no-ignore          walk files that .gitignore excludes

Exit codes: 0 clear · 1 findings · 2 malformed question.
For a run over many files, the exit code is the worst outcome in it.";

/// Every flag the parser accepts. Held equal to the flags named in
/// USAGE by a test, because a flag documented and not implemented — or
/// implemented and not documented — is the failure nobody notices until
/// a user hits it.
const FLAGS: [&str; 8] = [
    "--no-resolve",
    "--root",
    "--deny-symlinks",
    "--format",
    "--stdin",
    "--follow-symlinks",
    "--hidden",
    "--no-ignore",
];

#[derive(Debug)]
struct Options {
    inputs: Vec<PathBuf>,
    stdin: bool,
    format: Option<&'static str>,
    root: Option<String>,
    resolve: bool,
    deny_symlinks: bool,
    walk: WalkOptions,
}

pub(crate) fn run() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if let Some(first) = args.first() {
        match first.as_str() {
            "mcp" => return crate::mcp::serve(),
            "--help" | "-h" => {
                println!("{USAGE}");
                return ExitCode::SUCCESS;
            }
            "--version" | "-V" => {
                println!("paths-le {}", env!("CARGO_PKG_VERSION"));
                return ExitCode::SUCCESS;
            }
            _ => {}
        }
    }

    match execute(&args) {
        Ok(code) => ExitCode::from(code),
        Err(message) => {
            eprintln!("paths-le: {message}");
            ExitCode::from(2)
        }
    }
}

fn execute(args: &[String]) -> Result<u8, String> {
    let options = parse(args)?;
    let reports = if options.stdin {
        vec![audit_stdin(&options)?]
    } else {
        audit_inputs(&options)?
    };

    let mut stdout = std::io::stdout().lock();
    for report in &reports {
        let line = serde_json::to_string(report).expect("a report serializes");
        writeln!(stdout, "{line}")
            .map_err(|error| format!("could not write the report: {error}"))?;
    }
    drop(stdout);

    summarise(&reports, options.resolve);
    Ok(audit::exit_code(&reports))
}

fn audit_inputs(options: &Options) -> Result<Vec<FileReport>, String> {
    let targets = walk::collect(&options.inputs, &options.walk)?;
    let audit_options = AuditOptions {
        resolve: options.resolve,
        root: choose_root(options.root.as_deref(), &options.inputs)?,
        deny_symlinks: options.deny_symlinks,
    };
    Ok(targets
        .iter()
        .map(|target| audit::audit_file(target, &audit_options))
        .collect())
}

fn audit_stdin(options: &Options) -> Result<FileReport, String> {
    let format = options.format.ok_or_else(|| {
        "reading from stdin needs --format: the name that would carry the format is not there"
            .to_string()
    })?;

    let mut content = String::new();
    std::io::stdin()
        .read_to_string(&mut content)
        .map_err(|error| format!("could not read stdin: {error}"))?;

    // A document arriving on stdin has no directory of its own, so a
    // relative path in it resolves against the working directory. That
    // is the only defensible base, and it is stated in the report's
    // file label rather than left to be inferred.
    let working = std::env::current_dir()
        .map_err(|error| format!("could not read the working directory: {error}"))?;
    let target = Target {
        path: working.join("<stdin>"),
        language_id: format,
    };
    let audit_options = AuditOptions {
        resolve: options.resolve,
        root: choose_root(options.root.as_deref(), &[working])?,
        deny_symlinks: options.deny_symlinks,
    };
    let mut report = audit::audit_content(&content, &target, &audit_options);
    report.file = "<stdin>".to_string();
    Ok(report)
}

/// The boundary a relative path may not escape.
///
/// **The enclosing git repository, when there is one.** The extension's
/// `resolveWorkspaceRelative` resolves against the *workspace folder* —
/// the project, not the file's directory — and a repository is what a
/// workspace folder is on a command line. Defaulting to the directory
/// argument instead made every cross-package import in a monorepo an
/// escape: auditing one package of this very family produced three
/// `escapes-root` findings for `../../shared/...`, all of them correct
/// code.
///
/// Canonical, always: the escape check compares a resolved target
/// against this, and two spellings of the same directory would make it
/// fire on paths that never left.
pub(crate) fn choose_root(explicit: Option<&str>, inputs: &[PathBuf]) -> Result<PathBuf, String> {
    if let Some(root) = explicit {
        let path = PathBuf::from(root);
        if !path.is_dir() {
            return Err(format!("{root} is not a directory"));
        }
        return std::fs::canonicalize(&path).map_err(|error| format!("{root}: {error}"));
    }

    let start = match inputs {
        [only] if only.is_dir() => only.clone(),
        [only] => only
            .parent()
            .map_or_else(|| PathBuf::from("."), PathBuf::from),
        _ => std::env::current_dir()
            .map_err(|error| format!("could not read the working directory: {error}"))?,
    };
    let start =
        std::fs::canonicalize(&start).map_err(|error| format!("{}: {error}", start.display()))?;

    Ok(enclosing_repository(&start).unwrap_or(start))
}

/// The nearest ancestor holding a `.git`, if any.
///
/// A worktree and a submodule carry `.git` as a file rather than a
/// directory, so the test is existence, not kind.
fn enclosing_repository(start: &std::path::Path) -> Option<PathBuf> {
    start
        .ancestors()
        .find(|ancestor| ancestor.join(".git").exists())
        .map(PathBuf::from)
}

fn parse(args: &[String]) -> Result<Options, String> {
    let mut options = Options {
        inputs: Vec::new(),
        stdin: false,
        format: None,
        root: None,
        resolve: true,
        deny_symlinks: false,
        walk: WalkOptions::default(),
    };

    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        // Strict parsing, never a silent default: an unrecognised flag
        // is a question this cannot answer, not one to guess at. A
        // typo'd `--stict` that silently did nothing would report a
        // clean audit that never ran the check asked for.
        //
        // The check is against FLAGS rather than the match below, so
        // FLAGS is what the parser actually accepts — which is what
        // makes holding it equal to the usage text worth anything.
        if arg.starts_with('-') && !FLAGS.contains(&arg.as_str()) {
            return Err(format!("{arg} is not an option. Try --help."));
        }

        match arg.as_str() {
            "--no-resolve" => options.resolve = false,
            "--deny-symlinks" => options.deny_symlinks = true,
            "--stdin" => options.stdin = true,
            "--hidden" => options.walk.hidden = true,
            "--no-ignore" => options.walk.respect_ignore = false,
            "--follow-symlinks" => options.walk.follow_symlinks = true,
            "--root" => {
                options.root = Some(
                    rest.next()
                        .ok_or_else(|| "--root needs a directory".to_string())?
                        .clone(),
                );
            }
            "--format" => {
                let value = rest
                    .next()
                    .ok_or_else(|| "--format needs a format".to_string())?;
                let resolved = resolve_format(Some(value), None).ok_or_else(|| {
                    format!(
                        "{value} is not a format this understands; one of: {}",
                        SUPPORTED_FORMATS.join(", ")
                    )
                })?;
                options.format = Some(resolved);
                options.walk.format = Some(resolved);
            }
            path => options.inputs.push(PathBuf::from(path)),
        }
    }

    if options.stdin && !options.inputs.is_empty() {
        return Err("reading from stdin takes no file arguments".to_string());
    }
    if !options.stdin && options.inputs.is_empty() {
        return Err("name a file or a directory to audit. Try --help.".to_string());
    }
    Ok(options)
}

/// The human half. Every line here restates something already in the
/// JSON — a summary that says more than the report would be a second
/// source of truth.
fn summarise(reports: &[FileReport], resolved: bool) {
    let mut stderr = std::io::stderr().lock();
    let mut findings = 0;
    let mut paths = 0;

    for report in reports {
        paths += report.summary.paths;
        for diagnostic in &report.diagnostics {
            let _ = writeln!(stderr, "{}: {}", report.file, diagnostic.message);
        }
        for audited in &report.paths {
            if !audited.resolution.verdict.is_finding(true) {
                continue;
            }
            findings += 1;
            let _ = writeln!(stderr, "{}", audit::describe(report, audited));
        }
    }

    let files = reports.len();
    let counted = reports
        .iter()
        .map(|report| report.summary.findings)
        .sum::<usize>();
    let tail = if resolved {
        plural(counted, "finding", "findings")
    } else {
        "not resolved".to_string()
    };
    // `findings` counts every verdict that could be one; `counted`
    // counts the ones this run is set to act on. Saying both keeps the
    // tally honest when symlinks were listed above but do not move the
    // exit code.
    let noted = findings - counted.min(findings);
    let noted = if noted > 0 {
        format!(", {noted} noted but not counted")
    } else {
        String::new()
    };
    let _ = writeln!(
        stderr,
        "{} in {} — {tail}{noted}",
        plural(paths, "path", "paths"),
        plural(files, "file", "files")
    );
}

fn plural(count: usize, one: &str, many: &str) -> String {
    format!("{count} {}", if count == 1 { one } else { many })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::TempTree;

    /// A flag documented and not implemented, or implemented and not
    /// documented, is the failure nobody notices until a user hits it.
    #[test]
    fn every_documented_flag_is_parsed_and_the_reverse() {
        let mut documented: Vec<&str> = USAGE
            .split_whitespace()
            .filter(|word| word.starts_with("--"))
            .map(|word| word.trim_end_matches([',', '.', ':']))
            .filter(|word| !matches!(*word, "--version" | "--help"))
            .collect();
        documented.sort_unstable();
        documented.dedup();

        let mut implemented = FLAGS.to_vec();
        implemented.sort_unstable();

        assert_eq!(documented, implemented);
    }

    /// The parser must actually accept every flag it claims to, which
    /// the list above cannot prove on its own.
    #[test]
    fn the_parser_accepts_every_flag_it_lists() {
        for flag in FLAGS {
            let args: Vec<String> = match flag {
                "--root" => vec![flag.to_string(), ".".to_string(), "x".to_string()],
                "--format" => vec![flag.to_string(), "json".to_string(), "x".to_string()],
                "--stdin" => vec![flag.to_string()],
                _ => vec![flag.to_string(), "x".to_string()],
            };
            assert!(parse(&args).is_ok(), "{flag}");
        }
    }

    #[test]
    fn an_unknown_flag_is_refused_rather_than_ignored() {
        let args = vec!["--stict".to_string(), "x".to_string()];
        let error = parse(&args).expect_err("a refusal");
        assert!(error.contains("--stict"), "{error}");
    }

    #[test]
    fn a_flag_missing_its_value_is_refused() {
        assert!(parse(&["--root".to_string()]).is_err());
        assert!(parse(&["--format".to_string()]).is_err());
    }

    #[test]
    fn an_unknown_format_is_refused_by_name() {
        let args = vec![
            "--format".to_string(),
            "python".to_string(),
            "x".to_string(),
        ];
        let error = parse(&args).expect_err("a refusal");
        assert!(error.contains("python"), "{error}");
    }

    #[test]
    fn naming_nothing_is_refused() {
        assert!(parse(&[]).is_err());
    }

    #[test]
    fn stdin_and_file_arguments_together_are_refused() {
        let args = vec!["--stdin".to_string(), "x".to_string()];
        assert!(parse(&args).is_err());
    }

    #[test]
    fn resolution_is_on_unless_turned_off() {
        assert!(parse(&["x".to_string()]).expect("parses").resolve);
        let off = parse(&["--no-resolve".to_string(), "x".to_string()]).expect("parses");
        assert!(!off.resolve);
    }

    #[test]
    fn an_explicit_root_must_be_a_directory() {
        let tree = TempTree::new("cli-root");
        let file = tree.write("a.json", "{}");
        let error = choose_root(Some(&file.to_string_lossy()), &[]).expect_err("a refusal");
        assert!(error.contains("not a directory"), "{error}");
    }

    #[test]
    fn a_single_directory_argument_becomes_the_root_outside_a_repository() {
        let tree = TempTree::new("cli-root-dir");
        let root = choose_root(None, &[tree.path().to_path_buf()]).expect("a root");
        assert_eq!(root, tree.path());
    }

    /// The monorepo case: auditing one package must not make every
    /// cross-package import an escape. Verified against this family,
    /// where it produced three false findings before the change.
    #[test]
    fn the_enclosing_repository_wins_over_the_directory_argument() {
        let tree = TempTree::new("cli-root-git");
        tree.mkdir(".git");
        let package = tree.mkdir("packages/app");
        assert_eq!(choose_root(None, &[package]).expect("a root"), tree.path());
    }

    /// A worktree and a submodule carry `.git` as a file.
    #[test]
    fn a_git_file_marks_a_repository_too() {
        let tree = TempTree::new("cli-root-worktree");
        tree.write(".git", "gitdir: /elsewhere\n");
        let package = tree.mkdir("packages/app");
        assert_eq!(choose_root(None, &[package]).expect("a root"), tree.path());
    }

    /// A file argument roots at its repository, not at its own
    /// directory — the same rule, so naming a file and naming its
    /// folder cannot disagree.
    #[test]
    fn a_file_argument_roots_at_its_repository() {
        let tree = TempTree::new("cli-root-file");
        tree.mkdir(".git");
        let file = tree.write("packages/app/a.json", "{}");
        assert_eq!(choose_root(None, &[file]).expect("a root"), tree.path());
    }

    /// Several inputs have no single obvious root, so the run starts
    /// from the working directory rather than picking one of them
    /// arbitrarily — and then the same repository rule applies.
    #[test]
    fn several_inputs_start_from_the_working_directory() {
        let tree = TempTree::new("cli-root-many");
        let a = tree.write("a.json", "{}");
        let b = tree.write("b.json", "{}");
        let root = choose_root(None, &[a, b]).expect("a root");
        let working = std::fs::canonicalize(std::env::current_dir().expect("a cwd"))
            .expect("a canonical cwd");
        let expected = working
            .ancestors()
            .find(|ancestor| ancestor.join(".git").exists())
            .map_or(working.clone(), std::path::Path::to_path_buf);
        assert_eq!(root, expected);
    }

    #[test]
    fn the_usage_text_names_the_exit_codes_it_returns() {
        for code in ["0", "1", "2"] {
            assert!(USAGE.contains(code), "exit code {code} is undocumented");
        }
    }
}
