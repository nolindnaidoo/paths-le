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
mod heuristics;
mod html;
mod javascript;
mod js;
mod json;
mod position;
mod schemes;
mod toml;

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ErrorCategory {
    Parsing,
    Format,
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
pub(crate) fn extract(content: &str, language_id: &str) -> Extraction {
    let file_type = determine_file_type(language_id);
    if file_type == FileType::Unknown {
        return Extraction::failed(
            ErrorCategory::Format,
            Severity::Info,
            format!(
                "Path extraction is not supported for {language_id} files. \
                 Supported formats: CSV, TOML, ENV, JS, TS, JSON, HTML, CSS."
            ),
        );
    }

    match extract_by_file_type(content, file_type) {
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
        FileType::Unknown => Ok(Vec::new()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_unsupported_language_is_a_format_error_not_an_empty_result() {
        let result = extract("print(\"hi\")", "python");
        assert!(!result.success);
        assert!(result.paths.is_empty());
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].category, ErrorCategory::Format);
        assert_eq!(result.errors[0].severity, Severity::Info);
        assert_eq!(
            result.errors[0].message,
            "Path extraction is not supported for python files. \
             Supported formats: CSV, TOML, ENV, JS, TS, JSON, HTML, CSS."
        );
    }

    /// An empty document is a true empty result, not a failure — the
    /// difference is what stops a caller reading "no paths here" as
    /// "this was never looked at".
    #[test]
    fn an_empty_document_succeeds_with_nothing() {
        for language in ["json", "toml", "csv", "dotenv", "javascript", "css", "html"] {
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
        ] {
            assert!(extract("", language).success, "{language}");
        }
    }
}
