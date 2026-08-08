//! `extract_paths` — the tool **both** servers offer.
//!
//! The npm server (`src/mcp/tools.ts`) and this one are meant to be the
//! same tool, not two similar ones: same schema, same envelope,
//! byte-identical output. `fixtures/mcp-extract-paths.json` runs
//! against both, so changing one without the other fails a build.
//!
//! It touches no filesystem, in either implementation. An agent already
//! has file-read tools; duplicating them here would add a
//! path-traversal surface for no capability. The tool that does need a
//! filesystem is `paths_le_audit`, and it is deliberately separate.

use serde_json::{Value, json};

use crate::extract::format::{SUPPORTED_FORMATS, resolve_format};
use crate::extract::{self, Severity};

/// Result caps, in units of "what fits in a context window". Identical
/// to the npm server's, because a caller that learns the ceiling from
/// one server must not find a different one on the other.
const DEFAULT_MAX_RESULTS: usize = 500;
const MAX_MAX_RESULTS: usize = 5000;

pub(crate) fn definition() -> Value {
    json!({
        "name": "extract_paths",
        "description": "Extract every file and directory path from a document, with its kind and \
                        1-based line and column. Supports JSON, TOML, CSV, dotenv, JavaScript, \
                        TypeScript, HTML and CSS. Each path is classified as file, relative, \
                        absolute or url. Paths are reported as written — nothing is resolved \
                        against a workspace or the filesystem.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "content": { "type": "string", "description": "The document text to scan." },
                "format": {
                    "type": "string",
                    "enum": SUPPORTED_FORMATS,
                    "description": "Document format. Provide this or `filename`. Common \
                                    extensions and aliases are accepted.",
                },
                "filename": {
                    "type": "string",
                    "description": "Filename used to infer the format when `format` is absent, \
                                    e.g. \"tsconfig.json\".",
                },
                "dedupe": {
                    "type": "boolean",
                    "default": false,
                    "description": "Collapse repeated paths to their first occurrence.",
                },
                "maxResults": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MAX_MAX_RESULTS,
                    "default": DEFAULT_MAX_RESULTS,
                    "description": format!(
                        "Cap on returned paths (default {DEFAULT_MAX_RESULTS}). meta.truncated \
                         reports whether any were dropped."
                    ),
                },
            },
            "required": ["content"],
            "additionalProperties": false,
        },
    })
}

/// Run the tool. `Err` is a message the caller can act on — a bad
/// argument, not a broken server.
pub(crate) fn run(arguments: &Value) -> Result<Value, String> {
    let content = arguments
        .get("content")
        .and_then(Value::as_str)
        .ok_or_else(|| "content is required and must be a string".to_string())?;
    let max_results = read_max_results(arguments)?;

    let format = arguments.get("format").and_then(Value::as_str);
    let filename = arguments.get("filename").and_then(Value::as_str);

    // Requiring one of the two up front gives a message naming the
    // problem, instead of the engine returning an empty result for an
    // unknown language.
    let language_id = resolve_format(format, filename).ok_or_else(|| {
        format!(
            "Provide `format` (one of: {}) or a `filename` with a recognised extension.",
            SUPPORTED_FORMATS.join(", ")
        )
    })?;

    let result = extract::extract(content, language_id);

    let mut values: Vec<Value> = result
        .paths
        .iter()
        .map(|path| {
            json!({
                "value": path.value,
                "type": path.kind,
                "line": path.position.line,
                "column": path.position.column,
            })
        })
        .collect();

    if arguments.get("dedupe").and_then(Value::as_bool) == Some(true) {
        let mut seen: Vec<&str> = Vec::new();
        let mut deduped = Vec::with_capacity(values.len());
        for value in &values {
            let text = value["value"].as_str().unwrap_or_default();
            if seen.contains(&text) {
                continue;
            }
            seen.push(text);
            deduped.push(value.clone());
        }
        values = deduped;
    }

    // The `truncated` flag matters more than the cap. Silently
    // returning the first 500 of 900 is an answer that is wrong in the
    // most expensive way: confidently incomplete, with nothing to
    // indicate it.
    let truncated = values.len() > max_results;
    values.truncate(max_results);

    let diagnostics: Vec<Value> = result
        .errors
        .iter()
        .map(|error| {
            json!({
                // The engine has an `info` level; a diagnostic has two,
                // because the only decision a caller makes from one is
                // whether the result is usable. `info` joins `warning`
                // rather than becoming a third value nothing branches
                // on — and never `error`, which would fail a result
                // that is fine.
                "severity": if error.severity == Severity::Error { "error" } else { "warning" },
                "code": format!("{:?}", error.category).to_lowercase(),
                "message": error.message,
            })
        })
        .collect();

    let count = values.len();
    Ok(super::envelope(
        "extract_paths",
        &json!({ "paths": values, "fileType": language_id }),
        count,
        &diagnostics,
        truncated,
    ))
}

/// Note the asymmetry, which the npm server also has: a nonsensical
/// value (zero, negative, fractional) throws, while a merely excessive
/// one is clamped. The first is a bug in the caller that it needs to
/// hear about; the second is a caller asking for everything, which is
/// reasonable. Clamp quietly, reject loudly.
fn read_max_results(arguments: &Value) -> Result<usize, String> {
    let Some(raw) = arguments.get("maxResults") else {
        return Ok(DEFAULT_MAX_RESULTS);
    };
    let invalid = "maxResults must be a positive integer".to_string();
    let value = raw.as_u64().ok_or(invalid.clone())?;
    if value < 1 {
        return Err(invalid);
    }
    Ok((value as usize).min(MAX_MAX_RESULTS))
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::*;
    use crate::extract::corpus::document;

    const CASES: &str = include_str!("../../fixtures/mcp-extract-paths.json");

    #[derive(Debug, Deserialize)]
    struct Case {
        name: String,
        file: Option<String>,
        content: Option<String>,
        arguments: Value,
        expected: Option<Value>,
        #[serde(rename = "expectedError")]
        expected_error: Option<String>,
    }

    /// The shared corpus, run against this server. The parity script
    /// runs the same cases against the npm one; a drift in either
    /// direction fails a build.
    #[test]
    fn every_shared_case_answers_identically() {
        let cases: Vec<Case> = serde_json::from_str(CASES).expect("the corpus is valid JSON");
        assert!(!cases.is_empty(), "the corpus is empty");

        for case in cases {
            let mut arguments = case.arguments.clone();
            let content = case
                .file
                .as_deref()
                .map(document)
                .map(str::to_string)
                .or(case.content);
            if let Some(content) = content {
                arguments["content"] = json!(content);
            }

            match (case.expected, case.expected_error) {
                (_, Some(expected)) => {
                    let error = run(&arguments).expect_err(&case.name);
                    assert_eq!(error, expected, "{}", case.name);
                }
                (Some(expected), None) => {
                    let actual = run(&arguments).expect(&case.name);
                    assert_eq!(actual, expected, "{}", case.name);
                }
                (None, None) => panic!("{} pins neither a result nor an error", case.name),
            }
        }
    }

    #[test]
    fn the_advertised_enum_matches_the_formats_that_resolve() {
        let definition = definition();
        let advertised = definition["inputSchema"]["properties"]["format"]["enum"]
            .as_array()
            .expect("an enum")
            .iter()
            .filter_map(|value| value.as_str().map(str::to_string))
            .collect::<Vec<String>>();
        assert_eq!(advertised, SUPPORTED_FORMATS);
    }

    #[test]
    fn an_excessive_cap_is_clamped_rather_than_refused() {
        let result = run(&json!({
            "content": "{}",
            "format": "json",
            "maxResults": MAX_MAX_RESULTS + 1_000,
        }));
        assert!(result.is_ok(), "{result:?}");
    }

    #[test]
    fn a_fractional_cap_is_refused() {
        let error = run(&json!({ "content": "{}", "format": "json", "maxResults": 1.5 }))
            .expect_err("a refusal");
        assert_eq!(error, "maxResults must be a positive integer");
    }

    /// The tool name is a public API with no deprecation channel: once
    /// an agent's prompt or memory references it, renaming it breaks
    /// silently.
    #[test]
    fn the_tool_name_is_pinned() {
        assert_eq!(definition()["name"], "extract_paths");
    }
}
