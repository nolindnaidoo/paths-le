//! The pure extraction layer: document text in, paths with positions
//! out.
//!
//! **Nothing in here touches the filesystem.** That is what makes the
//! whole decision layer testable from `fixtures/` with no temp
//! directories and no flake, and it is why the coverage floor lives on
//! this module rather than on the crate total. A `std::fs` call
//! appearing below this line is a bug.
//!
//! Everything here is a port. The extension is the reference
//! implementation and `fixtures/extraction.json` is the contract; see
//! SPEC.md for what is deliberately ported bug-for-bug and why.

pub(crate) mod format;

mod css;
mod csv;
mod dotenv;
mod fallback;
mod heuristics;
mod html;
mod javascript;
mod js;
mod json;
mod position;
mod schemes;
mod toml;
mod yaml;

#[cfg(test)]
pub(crate) mod corpus;

pub(crate) use format::{FileType, determine_file_type};
pub(crate) use heuristics::PathType;
pub(crate) use position::Position;

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct Path {
    pub(crate) value: String,
    #[serde(rename = "type")]
    pub(crate) kind: PathType,
    // Flattened so a serialized path is `{ value, type, line, column,
    // context }` — the shape the npm MCP server already emits, which
    // `fixtures/mcp-extract-paths.json` pins across both servers.
    #[serde(flatten)]
    pub(crate) position: Position,
    pub(crate) context: String,
}

/// The extension's `ParseError` also has a `format` category. It existed
/// for one message — the unsupported-format refusal — and 0.2.0 replaced
/// that refusal with the generic scan, so nothing produces it on either
/// side any more. Kept out for the same reason `warning` is: a variant no
/// code path can reach is a claim the code does not back.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ErrorCategory {
    Parsing,
}

/// The extension's `ParseError` also has a `warning` level. Nothing in
/// either engine produces one today, so it is not modelled here — a
/// variant no code path can reach is a claim the code does not back.
/// The MCP surface maps these onto its own two-level severity, which is
/// where `warning` actually appears.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Severity {
    Info,
    Error,
}

/// The extension's `ParseError` carries `timestamp`, `recoverable`,
/// `recoveryAction` and `metadata` as well. None of them reaches either
/// surface — the MCP envelope projects a diagnostic down to exactly
/// these three fields — and a timestamp in a report is a value that
/// changes between two runs over identical input, which is the opposite
/// of what a corpus can pin. So the port carries what is observable and
/// nothing else.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct ExtractionError {
    pub(crate) category: ErrorCategory,
    pub(crate) severity: Severity,
    pub(crate) message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct Extraction {
    pub(crate) success: bool,
    pub(crate) paths: Vec<Path>,
    pub(crate) errors: Vec<ExtractionError>,
}

impl Extraction {
    fn found(paths: Vec<Path>) -> Self {
        Self {
            success: true,
            paths,
            errors: Vec::new(),
        }
    }

    fn failed(category: ErrorCategory, severity: Severity, message: String) -> Self {
        Self {
            success: false,
            paths: Vec::new(),
            errors: vec![ExtractionError {
                category,
                severity,
                message,
            }],
        }
    }
}

/// A format extractor's result. Only the four regex-driven extractors
/// can fail, and only by exhausting the backtracking budget on a
/// pathological document — a refusal, never a wrong answer. The
/// extension has no equivalent failure because its engine cannot report
/// one; reporting it here is a documented divergence in SPEC.md.
pub(crate) type Extracted = Result<Vec<Path>, String>;

/// Extract every path from a document.
///
/// `language_id` is a VS Code language id, exactly as the extension's
/// engine accepts. Callers holding a filename or a loose format name go
/// through `format::resolve_format` first.
///
/// A language with no typed extractor is read by the generic scan
/// rather than refused. The refusal it replaces —
/// `"Path extraction is not supported for {language_id} files"` — was
/// the honest answer while there was nothing to fall through to; with a
/// scan behind it, refusing would be declining to look at four fifths of
/// a repository.
pub(crate) fn extract(content: &str, language_id: &str) -> Extraction {
    match extract_by_file_type(content, determine_file_type(language_id)) {
        Ok(paths) => Extraction::found(paths),
        Err(message) => Extraction::failed(ErrorCategory::Parsing, Severity::Error, message),
    }
}

fn extract_by_file_type(content: &str, file_type: FileType) -> Extracted {
    match file_type {
        FileType::Csv => Ok(csv::extract(content)),
        FileType::Toml => Ok(toml::extract(content)),
        FileType::Dotenv => dotenv::extract(content),
        FileType::Javascript | FileType::Typescript => javascript::extract(content),
        FileType::Json => Ok(json::extract(content)),
        FileType::Css => css::extract(content),
        FileType::Html => html::extract(content),
        FileType::Yaml => Ok(yaml::extract(content)),
        FileType::Unknown => Ok(fallback::extract(content)),
    }
}

/// Whether a language is read by the generic scan rather than by a
/// typed extractor.
///
/// The audit layer needs this to decide whether resolution is opt-in for
/// a file: a scan is generous by construction, so a false positive in it
/// would surface as a `missing` finding rather than a quiet extra row.
pub(crate) fn is_generic_scan(language_id: &str) -> bool {
    determine_file_type(language_id) == FileType::Unknown
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Changed deliberately in 0.2.0: an unsupported language used to be
    /// a format diagnostic and an empty result. It is now the generic
    /// scan, which is why a Python file reports its paths at all.
    #[test]
    fn an_unsupported_language_is_scanned_rather_than_refused() {
        let result = extract("shutil.copy(\"./src/a.py\", DEST)", "python");
        assert!(result.success);
        assert!(result.errors.is_empty());
        assert_eq!(result.paths.len(), 1);
        assert_eq!(result.paths[0].value, "./src/a.py");
        assert_eq!(result.paths[0].context, "Text scan");
    }

    /// The message that refusal carried is gone from the engine
    /// entirely. Pinned because it is quoted in the extension, in the
    /// MCP corpus and in a command's notification, and a stray copy left
    /// behind would tell a user the file was skipped when it was read.
    #[test]
    fn nothing_still_says_extraction_is_unsupported() {
        for language in ["python", "rust", "markdown", "unknown"] {
            let result = extract("x = 1", language);
            assert!(
                result.errors.is_empty(),
                "{language} produced {:?}",
                result.errors
            );
        }
    }

    /// An empty document is a true empty result, not a failure — the
    /// difference is what stops a caller reading "no paths here" as
    /// "this was never looked at".
    #[test]
    fn an_empty_document_succeeds_with_nothing() {
        for language in [
            "json",
            "toml",
            "csv",
            "dotenv",
            "javascript",
            "css",
            "html",
            "yaml",
            "unknown",
        ] {
            let result = extract("", language);
            assert!(result.success, "{language}");
            assert!(result.paths.is_empty(), "{language}");
            assert!(result.errors.is_empty(), "{language}");
        }
    }

    #[test]
    fn every_supported_language_id_dispatches() {
        for language in [
            "csv",
            "toml",
            "dotenv",
            "env",
            "javascript",
            "javascriptreact",
            "typescript",
            "typescriptreact",
            "json",
            "jsonc",
            "html",
            "css",
            "scss",
            "less",
            "yaml",
        ] {
            assert!(extract("", language).success, "{language}");
        }
    }

    /// The typed extractors are exactly the ones that are not the scan,
    /// and the audit layer branches on that answer.
    #[test]
    fn only_the_untyped_languages_are_a_generic_scan() {
        for language in [
            "json",
            "toml",
            "csv",
            "dotenv",
            "javascript",
            "css",
            "html",
            "yaml",
        ] {
            assert!(!is_generic_scan(language), "{language}");
        }
        for language in ["python", "markdown", "xml", "unknown"] {
            assert!(is_generic_scan(language), "{language}");
        }
    }
}
