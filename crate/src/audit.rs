//! One file, end to end — the only path either surface calls.
//!
//! `cli.rs` and `mcp/` both come through here, so a rule can only be
//! written once. A surface that grows its own copy of one is a bug, and
//! `tests/contracts.rs` asserts the two agree on the same input.

use std::path::PathBuf;

use serde::Serialize;

use crate::extract::{self, Path, Severity};
use crate::resolve::{self, Resolution, Verdict};
use crate::walk::Target;

#[derive(Debug, Clone)]
pub(crate) struct AuditOptions {
    /// When false, every path comes back `unresolved` and no path can
    /// be a finding — the run reports what is written and nothing else.
    pub(crate) resolve: bool,
    /// Whether resolution also applies to a file read by the generic
    /// scan. Off by default, and it is the one asymmetry in this tool.
    ///
    /// The scan reads raw text and is generous by construction, so this
    /// tool's own honesty rule bites: resolving what it finds turns a
    /// false positive into a `missing` finding — a claim — instead of a
    /// quiet extra row. A typed extractor was handed a delimited token
    /// by a parser and has earned the claim; a scan has not, so it has
    /// to be asked.
    pub(crate) resolve_scanned: bool,
    /// The boundary a relative path may not escape. Absolute and
    /// canonical, or the escape check compares two spellings of the
    /// same directory.
    pub(crate) root: PathBuf,
    /// Promote a symlink to a finding. Off by default: the extension
    /// treats resolving a link as an ordinary step, not an anomaly.
    pub(crate) deny_symlinks: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct Diagnostic {
    pub(crate) severity: Severity,
    pub(crate) code: String,
    pub(crate) message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct AuditedPath {
    #[serde(flatten)]
    pub(crate) path: Path,
    pub(crate) resolution: Resolution,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub(crate) struct Summary {
    pub(crate) paths: usize,
    pub(crate) findings: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct FileReport {
    pub(crate) file: String,
    pub(crate) format: String,
    pub(crate) paths: Vec<AuditedPath>,
    pub(crate) diagnostics: Vec<Diagnostic>,
    pub(crate) summary: Summary,
}

impl FileReport {
    /// Whether this file looked like text and could not be read as it —
    /// a permission, a broken encoding.
    ///
    /// Reported rather than swallowed, because a report that quietly
    /// skipped a file would be claiming coverage it does not have. It
    /// does **not** fail the run on its own; `--strict` is how a
    /// pipeline says it wants zero tolerance. A binary file never gets
    /// here — see `audit_file`.
    pub(crate) fn was_skipped(&self) -> bool {
        self.diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "skipped")
    }

    /// Whether the audit of this file gave up part way. Unlike a skip
    /// this **does** fail the run: reporting no findings for a file it
    /// never finished reading would overstate coverage.
    pub(crate) fn is_incomplete(&self) -> bool {
        self.diagnostics
            .iter()
            .any(|diagnostic| diagnostic.severity == Severity::Error)
    }
}

/// How many bytes decide whether a file is binary. ripgrep's number, so
/// "what this tool reads" and "what ripgrep reads" stay the same answer
/// the way the walker's ignore rules already do.
const BINARY_SNIFF_BYTES: usize = 8 * 1024;

/// Whether a file was never a text candidate.
///
/// **A NUL byte in the first 8KB means binary**, which is ripgrep's
/// heuristic and wrong only on files no path lives in anyway.
fn is_binary(bytes: &[u8]) -> bool {
    bytes[..bytes.len().min(BINARY_SNIFF_BYTES)].contains(&0)
}

/// Audit one file, or `None` when it is binary.
///
/// **A binary file is not a skipped file, and the difference is the
/// whole point of `--strict`.** A skipped file is one that looked like
/// text and could not be read — a permission, a broken encoding — and a
/// pipeline with zero tolerance wants to hear about it. A PNG is not
/// that: it was never a text candidate, and before the walk widened it
/// was never opened. Reporting it would make `--strict` exit 2 on every
/// repository that contains an image, which is every repository.
///
/// Silence per file, not silence overall: the caller counts these and
/// the run's summary says how many, because a narrower coverage than the
/// tree nobody was told about is the failure this tool exists to avoid.
pub(crate) fn audit_file(target: &Target, options: &AuditOptions) -> Option<FileReport> {
    let file = resolve::display(&target.path);

    let skipped = |reason: String| FileReport {
        file: file.clone(),
        format: target.language_id.to_string(),
        paths: Vec::new(),
        diagnostics: vec![Diagnostic {
            // The extension's vocabulary has two levels and `Error` is
            // reserved for an audit that gave up part way. A file that
            // was never text is not that, so the `skipped` code carries
            // the meaning and the severity stays out of the exit code.
            severity: Severity::Info,
            code: "skipped".to_string(),
            message: reason,
        }],
        summary: Summary {
            paths: 0,
            findings: 0,
        },
    };

    let bytes = match std::fs::read(&target.path) {
        Ok(bytes) => bytes,
        Err(error) => return Some(skipped(error.to_string())),
    };
    if is_binary(&bytes) {
        return None;
    }
    // Named rather than dropped. A file that looked like text and was
    // not readable as text is a file the reader would otherwise believe
    // was covered.
    let Ok(content) = String::from_utf8(bytes) else {
        return Some(skipped("not UTF-8 text".to_string()));
    };

    Some(audit_content(without_bom(&content), target, options))
}

/// The same audit over content already in hand. Split out so the MCP
/// surface can answer for a document it was handed, and so the whole
/// path below the file read is testable without one.
pub(crate) fn audit_content(content: &str, target: &Target, options: &AuditOptions) -> FileReport {
    let extraction = extract::extract(content, target.language_id);
    let diagnostics: Vec<Diagnostic> = extraction
        .errors
        .iter()
        .map(|error| Diagnostic {
            severity: error.severity,
            code: format!("{:?}", error.category).to_lowercase(),
            message: error.message.clone(),
        })
        .collect();

    // Canonical, because the root it will be compared against is.
    //
    // The paths reported to the reader stay exactly as they were
    // walked — `./src/app.ts` rather than `/private/var/…/src/app.ts` —
    // but the *comparison* has to happen in one spelling. Skipping this
    // made every relative path on macOS an `escapes-root` finding, since
    // the walked path began `/var` and the canonical root began
    // `/private/var`. A tool whose findings depend on how its argument
    // was spelled is worse than one that reports nothing.
    //
    // Falling back to the lexical parent is the honest degradation: the
    // directory of a file that was just read should always canonicalise,
    // and if it somehow does not, the escape check behaves as it would
    // have anyway rather than the audit failing.
    let base_dir = resolve::parent_dir(&target.path);
    let base_dir = std::fs::canonicalize(&base_dir).unwrap_or(base_dir);

    let scanned = extract::is_generic_scan(target.language_id);
    let resolve = options.resolve && (!scanned || options.resolve_scanned);
    let declined = if scanned && options.resolve {
        "a generic scan reports paths as written unless resolution is asked for"
    } else {
        "resolution was not requested"
    };

    let paths: Vec<AuditedPath> = extraction
        .paths
        .into_iter()
        .map(|path| {
            let resolution = if resolve {
                resolve::resolve(&path.value, path.kind, &base_dir, &options.root)
            } else {
                Resolution::unresolved(declined)
            };
            AuditedPath { path, resolution }
        })
        .collect();

    let findings = paths
        .iter()
        .filter(|audited| audited.resolution.verdict.is_finding(options.deny_symlinks))
        .count();

    FileReport {
        // Separators forward on every platform: a report is a document
        // somebody diffs against the same report taken elsewhere.
        file: resolve::display(&target.path),
        format: target.language_id.to_string(),
        summary: Summary {
            paths: paths.len(),
            findings,
        },
        paths,
        diagnostics,
    }
}

/// The exit code for a whole run: 0 clear, 1 findings, 2 the question
/// could not be answered. A run over many files reports the worst
/// outcome in it.
pub(crate) fn exit_code(reports: &[FileReport], strict: bool) -> u8 {
    // An audit that gave up part way always fails: it would otherwise
    // report "nothing found" for a file it never finished reading.
    if reports.iter().any(FileReport::is_incomplete) {
        return 2;
    }
    if strict && reports.iter().any(FileReport::was_skipped) {
        return 2;
    }
    u8::from(reports.iter().any(|report| report.summary.findings > 0))
}

/// The one-line human projection of a single path. It says exactly what
/// the JSON says — never prose the report does not carry.
pub(crate) fn describe(report: &FileReport, audited: &AuditedPath) -> String {
    let verdict = match audited.resolution.verdict {
        Verdict::Ok => "ok",
        Verdict::Symlinked => "symlink",
        Verdict::NonCanonical => "non-canonical",
        Verdict::Missing => "missing",
        Verdict::EscapesRoot => "escapes root",
        Verdict::Unresolved => "unresolved",
    };
    let detail = audited
        .resolution
        .reason
        .as_deref()
        .map(|reason| format!(" — {reason}"))
        .unwrap_or_default();
    format!(
        "{}:{}:{}  {}  [{verdict}{detail}]",
        report.file, audited.path.position.line, audited.path.position.column, audited.path.value
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::TempTree;
    use crate::walk::{WalkOptions, collect};

    fn options(tree: &TempTree) -> AuditOptions {
        AuditOptions {
            resolve: true,
            resolve_scanned: false,
            root: tree.path().to_path_buf(),
            deny_symlinks: false,
        }
    }

    fn audit_one(tree: &TempTree, relative: &str, options: &AuditOptions) -> FileReport {
        let targets = collect(&[tree.path().join(relative)], &WalkOptions::default())
            .expect("the walk succeeds");
        audit_file(&targets[0], options).expect("a text file")
    }

    #[test]
    fn a_resolved_path_that_exists_is_not_a_finding() {
        let tree = TempTree::new("audit-ok");
        tree.write("src/helper.ts", "");
        tree.write("src/app.ts", "import './helper.ts';\n");
        let report = audit_one(&tree, "src/app.ts", &options(&tree));
        assert_eq!(report.summary.paths, 1);
        assert_eq!(report.summary.findings, 0);
        assert_eq!(report.paths[0].resolution.verdict, Verdict::Ok);
    }

    #[test]
    fn a_path_that_does_not_exist_is_a_finding() {
        let tree = TempTree::new("audit-missing");
        tree.write("src/app.ts", "import './gone.ts';\n");
        let report = audit_one(&tree, "src/app.ts", &options(&tree));
        assert_eq!(report.summary.findings, 1);
        assert_eq!(exit_code(&[report], false), 1);
    }

    /// The base directory is the file's own, so the same written path
    /// in two files resolves to two different places.
    #[test]
    fn resolution_is_relative_to_the_file_not_the_run() {
        let tree = TempTree::new("audit-base");
        tree.write("a/target.ts", "");
        tree.write("a/app.ts", "import './target.ts';\n");
        tree.write("b/app.ts", "import './target.ts';\n");
        let opts = options(&tree);
        assert_eq!(
            audit_one(&tree, "a/app.ts", &opts).paths[0]
                .resolution
                .verdict,
            Verdict::Ok
        );
        assert_eq!(
            audit_one(&tree, "b/app.ts", &opts).paths[0]
                .resolution
                .verdict,
            Verdict::Missing
        );
    }

    #[test]
    fn without_resolution_nothing_can_be_a_finding() {
        let tree = TempTree::new("audit-no-resolve");
        tree.write("src/app.ts", "import './gone.ts';\n");
        let report = audit_one(
            &tree,
            "src/app.ts",
            &AuditOptions {
                resolve: false,
                ..options(&tree)
            },
        );
        assert_eq!(report.summary.paths, 1);
        assert_eq!(report.summary.findings, 0);
        assert_eq!(report.paths[0].resolution.verdict, Verdict::Unresolved);
        assert_eq!(
            report.paths[0].resolution.reason.as_deref(),
            Some("resolution was not requested")
        );
        assert_eq!(exit_code(&[report], false), 0);
    }

    /// Canonicalisation is the audit, so a non-canonical path counts
    /// without being asked for. `normalizePath` in the extension is the
    /// definition being held to.
    #[test]
    fn a_non_canonical_path_is_a_finding_by_default() {
        let tree = TempTree::new("audit-canon");
        tree.write("src/helper.ts", "");
        tree.write("src/app.ts", "import './/helper.ts';\n");
        let report = audit_one(&tree, "src/app.ts", &options(&tree));
        assert_eq!(report.paths[0].resolution.verdict, Verdict::NonCanonical);
        assert_eq!(report.summary.findings, 1);
    }

    /// A link is a fact until someone asks — and asking is the point of
    /// a symlink audit, so it has to be askable.
    #[cfg(unix)]
    #[test]
    fn a_symlink_counts_only_when_denied() {
        let tree = TempTree::new("audit-denylinks");
        tree.write("src/real.ts", "");
        tree.symlink("real.ts", "src/link.ts");
        tree.write("src/app.ts", "import './link.ts';\n");

        let quiet = audit_one(&tree, "src/app.ts", &options(&tree));
        assert_eq!(quiet.paths[0].resolution.verdict, Verdict::Symlinked);
        assert_eq!(quiet.summary.findings, 0);

        let denied = audit_one(
            &tree,
            "src/app.ts",
            &AuditOptions {
                deny_symlinks: true,
                ..options(&tree)
            },
        );
        assert_eq!(denied.summary.findings, 1);
    }

    /// Changed deliberately: a file that is not text is reported and
    /// does not fail the run, because every repository has one and
    /// exiting 2 on it meant the tool never got run in CI at all.
    ///
    /// The bytes carry no NUL, so this is a text candidate that could
    /// not be read — not a binary file, which is the case below.
    #[test]
    fn a_file_that_is_not_text_is_reported_and_does_not_end_the_run() {
        let tree = TempTree::new("audit-unreadable");
        let path = tree.path().join("broken.json");
        std::fs::write(&path, [0xff, 0xfe, 0x41]).expect("a file");
        let targets = collect(&[path], &WalkOptions::default()).expect("the walk succeeds");
        let report = audit_file(&targets[0], &options(&tree)).expect("a report");
        assert!(report.was_skipped());
        assert_eq!(report.diagnostics[0].code, "skipped");
        assert_eq!(report.diagnostics[0].message, "not UTF-8 text");
        assert_eq!(exit_code(std::slice::from_ref(&report), false), 0);
        assert_eq!(exit_code(&[report], true), 2, "--strict is opt-in");
    }

    /// A binary file is not a skipped file. Widening the walk brought
    /// every PNG in a repository into the reader; reporting each of them
    /// as skipped made `--strict` exit 2 on any tree with an image in
    /// it, which is the flag being useless rather than strict.
    #[test]
    fn a_binary_file_produces_no_report_at_all() {
        let tree = TempTree::new("audit-binary");
        let path = tree.path().join("logo.png");
        std::fs::write(&path, [0x89, b'P', b'N', b'G', 0x00, 0x1a]).expect("a file");
        let targets = collect(&[path], &WalkOptions::default()).expect("the walk succeeds");
        assert!(audit_file(&targets[0], &options(&tree)).is_none());
    }

    /// The sniff window is bounded, so a NUL past it is content rather
    /// than evidence — and a file of pure text stays text however long
    /// it is.
    #[test]
    fn the_binary_sniff_reads_only_the_first_bytes() {
        let mut early = vec![b'a'; 16];
        early.push(0);
        assert!(is_binary(&early));

        let mut late = vec![b'a'; BINARY_SNIFF_BYTES];
        late.push(0);
        assert!(!is_binary(&late));

        assert!(!is_binary(b"plain text"));
        assert!(!is_binary(b""));
    }

    #[test]
    fn the_worst_outcome_in_a_run_is_the_one_reported() {
        let tree = TempTree::new("audit-worst");
        tree.write("ok.json", "{}");
        tree.write("bad.json", "{\"a\":\"./gone.ts\"}");
        let targets = collect(&[tree.path().to_path_buf()], &WalkOptions::default())
            .expect("the walk succeeds");
        let reports: Vec<FileReport> = targets
            .iter()
            .filter_map(|target| audit_file(target, &options(&tree)))
            .collect();
        assert_eq!(exit_code(&reports, false), 1);
    }

    #[test]
    fn nothing_to_examine_exits_clear() {
        assert_eq!(exit_code(&[], false), 0);
    }

    /// A regression, found by running the binary rather than the tests.
    ///
    /// The root is canonical; a file reached through a symlinked
    /// directory is not. Comparing the two spellings made every
    /// relative path an `escapes-root` finding — on macOS, where the
    /// temporary directory is itself a link, that was every path in
    /// every run. Every unit test passed, because every one of them
    /// built its own canonical root.
    #[cfg(unix)]
    #[test]
    fn a_file_reached_through_a_linked_directory_does_not_escape() {
        let tree = TempTree::new("audit-alias");
        tree.write("real/target.ts", "");
        tree.write("real/app.ts", "import './target.ts';\n");
        tree.symlink("real", "alias");

        let target = Target {
            path: tree.path().join("alias/app.ts"),
            language_id: "typescript",
        };
        let report = audit_file(&target, &options(&tree)).expect("a report");
        assert_eq!(report.paths[0].resolution.verdict, Verdict::Ok);
        assert_eq!(report.summary.findings, 0);
    }

    /// The human line carries the same facts as the JSON and no others.
    #[test]
    fn the_human_line_projects_the_report() {
        let tree = TempTree::new("audit-describe");
        tree.write("src/app.ts", "import './gone.ts';\n");
        let report = audit_one(&tree, "src/app.ts", &options(&tree));
        let line = describe(&report, &report.paths[0]);
        assert!(line.contains("./gone.ts"), "{line}");
        assert!(line.contains(":1:"), "{line}");
        assert!(
            line.contains("[missing — no such file or directory]"),
            "{line}"
        );
    }

    /// Changed deliberately in 0.2.0: a language with no typed
    /// extractor used to produce a `format` diagnostic and no paths. It
    /// is read by the generic scan now, and the report carries neither a
    /// diagnostic nor a claim about what it found.
    #[test]
    fn a_language_with_no_typed_extractor_is_scanned_and_not_resolved() {
        let tree = TempTree::new("audit-scanned");
        let target = Target {
            path: tree.write("app.py", ""),
            language_id: "python",
        };
        let report = audit_content("open(\"./gone.py\")", &target, &options(&tree));
        assert!(report.diagnostics.is_empty(), "{:?}", report.diagnostics);
        assert_eq!(report.summary.paths, 1);
        assert_eq!(report.summary.findings, 0);
        assert_eq!(report.paths[0].resolution.verdict, Verdict::Unresolved);
        assert_eq!(
            report.paths[0].resolution.reason.as_deref(),
            Some("a generic scan reports paths as written unless resolution is asked for")
        );
    }

    /// The scan's findings are reachable — asking is the whole point of
    /// the opt-in, so it has to be askable.
    #[test]
    fn a_scanned_file_resolves_when_it_is_asked_for() {
        let tree = TempTree::new("audit-scanned-resolve");
        let target = Target {
            path: tree.write("app.py", ""),
            language_id: "python",
        };
        let report = audit_content(
            "open(\"./gone.py\")",
            &target,
            &AuditOptions {
                resolve_scanned: true,
                ..options(&tree)
            },
        );
        assert_eq!(report.paths[0].resolution.verdict, Verdict::Missing);
        assert_eq!(report.summary.findings, 1);
    }

    /// The opt-in widens resolution; it cannot switch it back on. A run
    /// that asked for no filesystem at all gets none.
    #[test]
    fn the_scan_opt_in_cannot_override_no_resolution() {
        let tree = TempTree::new("audit-scanned-none");
        let target = Target {
            path: tree.write("app.py", ""),
            language_id: "python",
        };
        let report = audit_content(
            "open(\"./gone.py\")",
            &target,
            &AuditOptions {
                resolve: false,
                resolve_scanned: true,
                ..options(&tree)
            },
        );
        assert_eq!(report.paths[0].resolution.verdict, Verdict::Unresolved);
        assert_eq!(
            report.paths[0].resolution.reason.as_deref(),
            Some("resolution was not requested")
        );
    }

    /// A typed extractor was handed its token by a parser, so its paths
    /// resolve without being asked. YAML is the one added in 0.2.0.
    #[test]
    fn a_typed_extractor_resolves_without_the_opt_in() {
        let tree = TempTree::new("audit-yaml");
        let target = Target {
            path: tree.write("ci.yml", ""),
            language_id: "yaml",
        };
        let report = audit_content("run: ./gone.sh\n", &target, &options(&tree));
        assert_eq!(report.paths[0].resolution.verdict, Verdict::Missing);
        assert_eq!(report.summary.findings, 1);
    }
}

/// Drop a leading byte-order mark.
///
/// No editor shows it and VS Code strips it before the extension ever
/// sees a document, so without this the two frontends read the same file
/// differently the moment anything on Windows saves it — Notepad, Excel,
/// a PowerShell redirect. Three invisible bytes shift every column on
/// the first line, and before a `{` they make a JSON parser reject the
/// whole document, which is indistinguishable from a file with no paths
/// in it.
pub(crate) fn without_bom(content: &str) -> &str {
    content.strip_prefix('\u{feff}').unwrap_or(content)
}

#[cfg(test)]
mod hazards {
    use super::*;

    #[test]
    fn a_byte_order_mark_is_not_part_of_the_document() {
        assert_eq!(without_bom("\u{feff}abc"), "abc");
        assert_eq!(without_bom("abc"), "abc");
        assert_eq!(without_bom("a\u{feff}b"), "a\u{feff}b");
    }
}
