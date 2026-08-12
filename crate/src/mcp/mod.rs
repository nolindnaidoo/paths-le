//! The agent surface: the same audit over the Model Context Protocol on
//! stdio, so a model can ask the question instead of being handed a
//! directory listing and guessing.
//!
//! Two rules the family's MCP surfaces established:
//!
//! - **A negative answer is not an error.** A file full of broken paths
//!   comes back as an ordinary result. Only a malformed question is a
//!   protocol error. A model that reads a finding as a broken tool
//!   retries instead of reacting.
//! - **Refusals speak the caller's vocabulary.** An MCP caller has no
//!   command line, so no message here mentions a flag.
//!
//! Read-only by construction: nothing on this surface writes, so unlike
//! pixelactions there is no consent gate to design.

pub(crate) mod extract;

use std::io::{BufRead, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use serde_json::{Value, json};

use crate::audit::{self, AuditOptions};
use crate::walk::{self, WalkOptions};

const PROTOCOL_VERSION: &str = "2025-06-18";

/// JSON-RPC error codes, from the spec.
const INVALID_PARAMS: i64 = -32602;
const METHOD_NOT_FOUND: i64 = -32601;

pub(crate) fn serve() -> ExitCode {
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else {
            return ExitCode::from(2);
        };
        if line.trim().is_empty() {
            continue;
        }
        let Ok(request) = serde_json::from_str::<Value>(&line) else {
            // A frame that is not JSON has no id to answer against;
            // dropping it is the only honest option.
            continue;
        };
        let Some(response) = handle(&request) else {
            continue; // a notification: no reply
        };
        if writeln!(stdout, "{response}").is_err() || stdout.flush().is_err() {
            return ExitCode::from(2);
        }
    }
    ExitCode::SUCCESS
}

fn handle(request: &Value) -> Option<Value> {
    let id = request.get("id").cloned();
    let method = request.get("method")?.as_str()?;
    // Notifications carry no id and get no reply.
    id.as_ref()?;

    let result = match method {
        "initialize" => Ok(json!({
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "paths-le", "version": env!("CARGO_PKG_VERSION") },
        })),
        "tools/list" => Ok(json!({ "tools": tool_definitions() })),
        "tools/call" => call_tool(request.get("params")),
        "ping" => Ok(json!({})),
        other => Err((
            METHOD_NOT_FOUND,
            format!("this server does not implement {other}"),
        )),
    };

    Some(match result {
        Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
        Err((code, message)) => json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": code, "message": message },
        }),
    })
}

fn tool_definitions() -> Value {
    json!([
        extract::definition(),
        {
            "name": "paths_le_audit",
            "description": "Audit files or directories: find every path and report whether it \
                            still points at anything — missing, escaping the audited tree, \
                            non-canonical, or a symlink with its target. Reads the filesystem; \
                            never writes to it. Findings are a normal result, not an error.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "a file or directory to audit" },
                    "paths": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "several files or directories, instead of `path`",
                    },
                    "resolve": {
                        "type": "boolean",
                        "default": true,
                        "description": "check each path against the filesystem (default true). \
                                        With it off, paths are reported as written and none can \
                                        be a finding.",
                    },
                    "resolveScanned": {
                        "type": "boolean",
                        "default": false,
                        "description": "check the paths found in a file no format extractor \
                                        reads — Python, Markdown, a Dockerfile — against the \
                                        filesystem too. Those are found by scanning raw text, \
                                        so they are reported as written by default rather than \
                                        claimed to be missing.",
                    },
                    "root": {
                        "type": "string",
                        "description": "the directory a relative path may not escape; the \
                                        audited directory is used when omitted",
                    },
                    "denySymlinks": {
                        "type": "boolean",
                        "default": false,
                        "description": "count a symlink as a finding too; it is reported \
                                        either way",
                    },
                },
            },
        },
    ])
}

/// Protocol failures (no tool named, an unknown tool) are JSON-RPC
/// errors; a tool that fails on its arguments returns a result carrying
/// `isError`, so a model reads the reason and reacts rather than
/// concluding the server is broken. Same rule as the npm server.
fn call_tool(params: Option<&Value>) -> Result<Value, (i64, String)> {
    let params = params.ok_or((INVALID_PARAMS, "no tool call was supplied".to_string()))?;
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .ok_or((INVALID_PARAMS, "the tool call named no tool".to_string()))?;
    let arguments = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| json!({}));

    match name {
        "extract_paths" => Ok(match extract::run(&arguments) {
            Ok(result) => tool_result(&result),
            Err(message) => tool_failure(&message),
        }),
        "paths_le_audit" => Ok(match audit_tool(&arguments) {
            Ok(result) => tool_result(&result),
            Err(message) => tool_failure(&message),
        }),
        other => Err((
            INVALID_PARAMS,
            format!("this server offers no tool named {other}"),
        )),
    }
}

fn audit_tool(arguments: &Value) -> Result<Value, String> {
    let inputs = requested_paths(arguments)?;
    let resolve = arguments
        .get("resolve")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let resolve_scanned = arguments
        .get("resolveScanned")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let deny_symlinks = arguments
        .get("denySymlinks")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    let walk_options = WalkOptions::default();
    let targets = walk::collect(&inputs, &walk_options)?;
    let root = crate::cli::choose_root(arguments.get("root").and_then(Value::as_str), &inputs)?;
    let options = AuditOptions {
        resolve,
        resolve_scanned,
        root,
        deny_symlinks,
    };

    let reports: Vec<Value> = targets
        .iter()
        .filter_map(|target| audit::audit_file(target, &options))
        .map(|report| serde_json::to_value(&report).expect("a report serializes"))
        .collect();
    let binary = targets.len() - reports.len();

    let findings: u64 = reports
        .iter()
        .map(|report| report["summary"]["findings"].as_u64().unwrap_or(0))
        .sum();
    let unexamined: Vec<&Value> = reports
        .iter()
        .filter(|report| {
            report["diagnostics"]
                .as_array()
                .is_some_and(|diagnostics| diagnostics.iter().any(|d| d["severity"] == "error"))
        })
        .collect();

    let mut diagnostics = Vec::new();
    if !resolve {
        diagnostics.push(warning(
            "resolve",
            "paths were reported as written and not checked against the filesystem, so none \
             could be a finding",
        ));
    }
    // Said out loud rather than left in the per-path reasons. A model
    // reading "0 findings" over a tree of Python files would otherwise
    // conclude those files are clean, when what happened is that this
    // declined to claim either way.
    let scanned = targets
        .iter()
        .filter(|target| crate::extract::is_generic_scan(target.language_id))
        .count();
    if resolve && !resolve_scanned && scanned > 0 {
        diagnostics.push(warning(
            "scanned",
            &format!(
                "{scanned} of {} files had no format extractor and were scanned as raw text; \
                 their paths are reported as written, not checked",
                targets.len()
            ),
        ));
    }
    // Counted, not listed. A binary file is not a failure, but a run
    // that covered fewer files than the tree holds has to say so or the
    // count reads as coverage it does not have.
    if binary > 0 {
        diagnostics.push(warning(
            "binary",
            &format!("{binary} files were binary and hold no text to examine"),
        ));
    }
    for report in unexamined {
        diagnostics.push(warning(
            "unreadable",
            &format!(
                "{} could not be examined, so this audit does not cover it",
                report["file"].as_str().unwrap_or("a file")
            ),
        ));
    }

    let count = reports.len();
    Ok(envelope(
        "paths_le_audit",
        &json!({ "reports": reports, "findings": findings }),
        count,
        &diagnostics,
        false,
    ))
}

fn requested_paths(arguments: &Value) -> Result<Vec<PathBuf>, String> {
    if let Some(path) = arguments.get("path").and_then(Value::as_str) {
        return Ok(vec![PathBuf::from(path)]);
    }
    if let Some(items) = arguments.get("paths").and_then(Value::as_array) {
        let paths: Vec<PathBuf> = items
            .iter()
            .filter_map(|item| item.as_str().map(PathBuf::from))
            .collect();
        if paths.is_empty() {
            return Err("the list of paths was empty".to_string());
        }
        return Ok(paths);
    }
    Err("no file or directory was supplied to audit".to_string())
}

/// The one result shape every tool returns, matching the npm server's
/// envelope field for field: `{ ok, data, diagnostics, meta }`.
///
/// **`ok` reports whether the check ran, not whether the answer is
/// yes.** A file full of broken paths is the answer, not a failure to
/// produce one — conflating the two would have a model report a broken
/// tool when what it actually learned is that the paths are wrong.
pub(crate) fn envelope(
    tool: &str,
    data: &Value,
    count: usize,
    diagnostics: &[Value],
    truncated: bool,
) -> Value {
    let ok = !diagnostics
        .iter()
        .any(|diagnostic| diagnostic["severity"].as_str() == Some("error"));
    json!({
        "ok": ok,
        "data": data,
        "diagnostics": diagnostics,
        "meta": { "tool": tool, "count": count, "truncated": truncated },
    })
}

/// An MCP tool result: the envelope as text (what a model reads) and
/// the same envelope structured. Identical to what the npm server
/// emits, so a caller diffing the two servers finds nothing.
fn tool_result(envelope: &Value) -> Value {
    let text = serde_json::to_string_pretty(envelope).expect("an envelope serializes");
    json!({
        "content": [{ "type": "text", "text": text }],
        "structuredContent": envelope,
        "isError": false,
    })
}

fn warning(code: &str, message: &str) -> Value {
    json!({ "severity": "warning", "code": code, "message": message })
}

/// The tool could not run on the arguments given. `isError` so a model
/// reads the message and corrects itself.
fn tool_failure(message: &str) -> Value {
    json!({
        "content": [{ "type": "text", "text": message }],
        "isError": true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::TempTree;

    fn request(method: &str, params: &Value) -> Value {
        json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params })
    }

    fn call(name: &str, arguments: &Value) -> Value {
        handle(&request(
            "tools/call",
            &json!({ "name": name, "arguments": arguments }),
        ))
        .expect("a reply")
    }

    #[test]
    fn initialize_answers_with_the_protocol_version() {
        let response = handle(&request("initialize", &json!({}))).expect("a reply");
        assert_eq!(response["result"]["protocolVersion"], PROTOCOL_VERSION);
        assert_eq!(response["result"]["serverInfo"]["name"], "paths-le");
    }

    #[test]
    fn tools_list_offers_both_tools() {
        let response = handle(&request("tools/list", &json!({}))).expect("a reply");
        let tools = response["result"]["tools"].as_array().expect("tools");
        let names: Vec<&str> = tools.iter().filter_map(|t| t["name"].as_str()).collect();
        assert_eq!(names, ["extract_paths", "paths_le_audit"]);
    }

    #[test]
    fn a_notification_gets_no_reply() {
        let notification = json!({ "jsonrpc": "2.0", "method": "initialized" });
        assert!(handle(&notification).is_none());
    }

    #[test]
    fn an_unknown_method_is_a_protocol_error() {
        let response = handle(&request("does/not/exist", &json!({}))).expect("a reply");
        assert_eq!(response["error"]["code"], METHOD_NOT_FOUND);
    }

    #[test]
    fn an_unknown_tool_is_a_protocol_error() {
        let response = call("paths_le_rewrite", &json!({}));
        assert_eq!(response["error"]["code"], INVALID_PARAMS);
    }

    /// A bad argument is the tool failing on what it was given, not the
    /// server breaking — so it comes back as a result carrying isError.
    #[test]
    fn a_missing_argument_is_a_tool_failure_not_a_protocol_error() {
        let response = call("paths_le_audit", &json!({}));
        assert!(response.get("error").is_none(), "{response}");
        assert_eq!(response["result"]["isError"], true);
        assert!(
            response["result"]["content"][0]["text"]
                .as_str()
                .expect("a message")
                .contains("no file or directory")
        );
    }

    #[test]
    fn the_shared_tool_is_offered_and_answers() {
        let response = call(
            "extract_paths",
            &json!({ "content": "{\"a\":\"./x.ts\"}", "format": "json" }),
        );
        let envelope = &response["result"]["structuredContent"];
        assert_eq!(envelope["meta"]["tool"], "extract_paths");
        assert_eq!(envelope["data"]["paths"][0]["value"], "./x.ts");
        assert_eq!(envelope["ok"], true);
        assert_eq!(response["result"]["isError"], false);
    }

    /// The shared tool reaches no filesystem — that is the property
    /// that lets an agent call it anywhere, and it must not regress.
    #[test]
    fn the_shared_tool_needs_no_filesystem() {
        let response = call(
            "extract_paths",
            &json!({ "content": "{\"a\":\"/definitely/not/here.txt\"}", "format": "json" }),
        );
        let envelope = &response["result"]["structuredContent"];
        // A resolution field would mean it had looked.
        assert!(envelope["data"]["paths"][0].get("resolution").is_none());
        assert_eq!(
            envelope["data"]["paths"][0]["value"],
            "/definitely/not/here.txt"
        );
    }

    #[test]
    fn the_audit_tool_reports_findings_as_an_ordinary_result() {
        let tree = TempTree::new("mcp-audit");
        tree.write("app.ts", "import './gone.ts';\n");
        let response = call(
            "paths_le_audit",
            &json!({ "path": tree.path().to_string_lossy() }),
        );
        let envelope = &response["result"]["structuredContent"];
        assert_eq!(response["result"]["isError"], false);
        assert_eq!(envelope["ok"], true, "a finding is not a broken tool");
        assert_eq!(envelope["data"]["findings"], 1);
        assert_eq!(envelope["meta"]["count"], 1);
    }

    #[test]
    fn the_audit_tool_says_when_it_did_not_look() {
        let tree = TempTree::new("mcp-audit-noresolve");
        tree.write("app.ts", "import './gone.ts';\n");
        let response = call(
            "paths_le_audit",
            &json!({ "path": tree.path().to_string_lossy(), "resolve": false }),
        );
        let envelope = &response["result"]["structuredContent"];
        assert_eq!(envelope["data"]["findings"], 0);
        assert_eq!(envelope["diagnostics"][0]["code"], "resolve");
    }

    #[test]
    fn a_path_that_does_not_exist_is_a_tool_failure() {
        let response = call("paths_le_audit", &json!({ "path": "/no/such/place-xyz" }));
        assert_eq!(response["result"]["isError"], true);
    }

    /// Refusals speak the caller's vocabulary: an MCP caller has no
    /// command line, so no message may name a flag.
    #[test]
    fn no_message_mentions_a_command_line_flag() {
        let definitions = serde_json::to_string(&tool_definitions()).expect("serializes");
        assert!(!definitions.contains("--"), "{definitions}");

        let tree = TempTree::new("mcp-vocabulary");
        tree.write("app.ts", "import './gone.ts';\n");
        for arguments in [
            json!({}),
            json!({ "paths": [] }),
            json!({ "path": "/no/such/place-xyz" }),
            json!({ "path": tree.path().to_string_lossy(), "resolve": false }),
        ] {
            let rendered =
                serde_json::to_string(&call("paths_le_audit", &arguments)).expect("serializes");
            assert!(!rendered.contains("--"), "{rendered}");
        }
    }

    /// Every tool returns the same envelope, so a caller writes one
    /// reader for all of them and for both servers.
    #[test]
    fn every_tool_returns_the_same_envelope_shape() {
        let tree = TempTree::new("mcp-envelope");
        tree.write("a.json", "{}");
        let results = [
            call(
                "extract_paths",
                &json!({ "content": "{}", "format": "json" }),
            ),
            call(
                "paths_le_audit",
                &json!({ "path": tree.path().to_string_lossy() }),
            ),
        ];
        for result in results {
            let envelope = &result["result"]["structuredContent"];
            assert!(envelope["ok"].is_boolean(), "{envelope}");
            assert!(!envelope["data"].is_null(), "{envelope}");
            assert!(envelope["diagnostics"].is_array(), "{envelope}");
            assert!(envelope["meta"]["tool"].is_string(), "{envelope}");
            assert!(envelope["meta"]["count"].is_number(), "{envelope}");
            assert!(envelope["meta"]["truncated"].is_boolean(), "{envelope}");
        }
    }
}
