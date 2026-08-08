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
    /// Whether this file could not be examined at all. A run containing
    /// one exits 2: a report that silently skipped a file would be
    /// claiming coverage it does not have.
    pub(crate) fn is_unexamined(&self) -> bool {
        self.diagnostics
            .iter()
            .any(|diagnostic| diagnostic.severity == Severity::Error)
    }
}

pub(crate) fn audit_file(target: &Target, options: &AuditOptions) -> FileReport {
    let file = target.path.to_string_lossy().into_owned();

    let content = match std::fs::read_to_string(&target.path) {
        Ok(content) => content,
        Err(error) => {
            return FileReport {
                file,
                format: target.language_id.to_string(),
                paths: Vec::new(),
                diagnostics: vec![Diagnostic {
                    severity: Severity::Error,
                    code: "unreadable".to_string(),
                    // A `.json` that is not UTF-8 is genuinely broken,
                    // so naming the reason is more useful than guessing
                    // at an encoding.
                    message: format!("could not be read: {error}"),
                }],
                summary: Summary {
                    paths: 0,
                    findings: 0,
                },
            };
        }
    };

    audit_content(&content, target, options)
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
    let base_dir = target
        .path
        .parent()
        .map_or_else(|| PathBuf::from("."), PathBuf::from);
    let base_dir = std::fs::canonicalize(&base_dir).unwrap_or(base_dir);

    let paths: Vec<AuditedPath> = extraction
        .paths
        .into_iter()
        .map(|path| {
            let resolution = if options.resolve {
                resolve::resolve(&path.value, path.kind, &base_dir, &options.root)
            } else {
                Resolution::unresolved("resolution was not requested")
            };
            AuditedPath { path, resolution }
        })
        .collect();

    let findings = paths
        .iter()
        .filter(|audited| audited.resolution.verdict.is_finding(options.deny_symlinks))
        .count();

    FileReport {
        file: target.path.to_string_lossy().into_owned(),
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
pub(crate) fn exit_code(reports: &[FileReport]) -> u8 {
    if reports.iter().any(FileReport::is_unexamined) {
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
            root: tree.path().to_path_buf(),
            deny_symlinks: false,
        }
    }

    fn audit_one(tree: &TempTree, relative: &str, options: &AuditOptions) -> FileReport {
        let targets = collect(&[tree.path().join(relative)], &WalkOptions::default())
            .expect("the walk succeeds");
        audit_file(&targets[0], options)
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
        assert_eq!(exit_code(&[report]), 1);
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
        assert_eq!(exit_code(&[report]), 0);
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

    #[test]
    fn an_unreadable_file_is_reported_and_ends_the_run_at_two() {
        let tree = TempTree::new("audit-unreadable");
        let path = tree.path().join("broken.json");
        std::fs::write(&path, [0xff, 0xfe, 0x00]).expect("a file");
        let targets = collect(&[path], &WalkOptions::default()).expect("the walk succeeds");
        let report = audit_file(&targets[0], &options(&tree));
        assert!(report.is_unexamined());
        assert_eq!(report.diagnostics[0].code, "unreadable");
        assert_eq!(exit_code(&[report]), 2);
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
            .map(|target| audit_file(target, &options(&tree)))
            .collect();
        assert_eq!(exit_code(&reports), 1);
    }

    #[test]
    fn nothing_to_examine_exits_clear() {
        assert_eq!(exit_code(&[]), 0);
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
        let report = audit_file(&target, &options(&tree));
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

    #[test]
    fn an_unsupported_format_becomes_a_diagnostic_not_a_silent_empty() {
        let tree = TempTree::new("audit-unsupported");
        let target = Target {
            path: tree.write("x.json", "{}"),
            language_id: "python",
        };
        let report = audit_content("print()", &target, &options(&tree));
        assert_eq!(report.diagnostics.len(), 1);
        assert_eq!(report.diagnostics[0].code, "format");
        assert_eq!(report.diagnostics[0].severity, Severity::Info);
        assert!(!report.is_unexamined(), "info is not an error");
    }
}
