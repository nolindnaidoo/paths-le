//! Paths from `.env` files: values of `KEY=VALUE` assignments, plus
//! keys that themselves look like paths.
//!
//! Line-based on purpose — dotenv is a line-oriented format. Columns
//! are offsets into the raw, untrimmed line and point at the value or
//! the key itself.
//!
//! A line whose key is *also* path-like emits twice, value first. That
//! is the extension's behaviour and the corpus pins it; it is listed in
//! SPEC.md among what is ported bug-for-bug.

use std::sync::LazyLock;

use fancy_regex::Regex;

use super::position::Position;
use super::{Path, heuristics, js};

/// `^(["']?)([^=]+?)\1=(.*)$` — the backreference makes the optional
/// quote symmetric, so `"KEY"=v` parses and `"KEY=v` does not. `regex`
/// cannot express it; see the note in Cargo.toml.
static ASSIGNMENT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"^(["']?)([^=]+?)\1=(.*)$"#).expect("a constant pattern compiles")
});

pub(crate) fn extract(content: &str) -> super::Extracted {
    if js::is_blank(content) {
        return Ok(Vec::new());
    }

    let mut paths = Vec::new();
    for (line_index, raw_line) in content.split('\n').enumerate() {
        let line = js::trim(raw_line);
        if line.starts_with('#') || line.is_empty() {
            continue;
        }

        let Some(captures) = ASSIGNMENT
            .captures(line)
            .map_err(|error| format!("the dotenv assignment pattern gave up: {error}"))?
        else {
            continue;
        };

        let quoted_key = captures.get(1).map_or("", |m| m.as_str());
        let key = js::trim(captures.get(2).map_or("", |m| m.as_str()));
        let raw_value = captures.get(3).map_or("", |m| m.as_str());
        if key.is_empty() || raw_value.is_empty() {
            continue;
        }

        let line_number = line_index + 1;
        let clean_value = clean(raw_value);

        if !clean_value.is_empty() && heuristics::is_path_like(&clean_value) {
            paths.push(Path {
                value: clean_value.clone(),
                kind: heuristics::classify_path_type(&clean_value),
                position: Position {
                    line: line_number,
                    column: value_column(raw_line, &clean_value, raw_value),
                },
                context: format!("Environment variable: {key}"),
            });
        }

        if heuristics::is_path_like(key) {
            let needle = if quoted_key.is_empty() {
                key.to_string()
            } else {
                format!("{quoted_key}{key}")
            };
            let found = index_of(raw_line, &needle);
            let quote_offset = isize::from(!quoted_key.is_empty());
            paths.push(Path {
                value: key.to_string(),
                kind: heuristics::classify_path_type(key),
                position: Position {
                    line: line_number,
                    column: (found + 1 + quote_offset).max(0) as usize,
                },
                context: "Environment variable name".to_string(),
            });
        }
    }
    Ok(paths)
}

/// `rawValue.replace(/^["']|["']$/g, '').trim().replace(/\\\\/g, '\\')`
/// — strip one surrounding quote from each end, trim, then collapse
/// escaped backslashes. Order matters: trimming before the quotes are
/// gone would leave `" ./x "` quoted.
fn clean(raw_value: &str) -> String {
    let unquoted = raw_value
        .strip_prefix(['"', '\''])
        .unwrap_or(raw_value)
        .to_string();
    let unquoted = unquoted
        .strip_suffix(['"', '\''])
        .unwrap_or(&unquoted)
        .to_string();
    js::trim(&unquoted).replace(r"\\", r"\")
}

/// 1-based UTF-16 column of the extracted value within the raw line.
/// Falls back to the raw value's position when unescaping changed the
/// text, and to just past the `=` when neither can be found.
fn value_column(raw_line: &str, clean_value: &str, raw_value: &str) -> usize {
    for needle in [clean_value, raw_value] {
        if let Some(offset) = raw_line.find(needle) {
            return utf16_column(raw_line, offset);
        }
    }
    (index_of(raw_line, "=") + 2).max(0) as usize
}

/// `String.prototype.indexOf`: a UTF-16 index, or -1. The sign matters
/// — the extension adds 1 to it unconditionally, so a miss yields
/// column 0 rather than a panic, and that arithmetic is ported as it
/// stands rather than tidied into something that answers differently.
fn index_of(haystack: &str, needle: &str) -> isize {
    match haystack.find(needle) {
        Some(offset) => haystack[..offset].encode_utf16().count() as isize,
        None => -1,
    }
}

fn utf16_column(line: &str, byte_offset: usize) -> usize {
    line[..byte_offset].encode_utf16().count() + 1
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::PathType;

    fn extract_ok(content: &str) -> Vec<Path> {
        extract(content).expect("the pattern holds")
    }

    #[test]
    fn a_blank_document_yields_nothing() {
        assert!(extract_ok("").is_empty());
    }

    #[test]
    fn comments_and_empty_lines_are_skipped() {
        let paths = extract_ok("# /commented/out.txt\n\n/real/path.txt=x\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 3);
    }

    #[test]
    fn a_value_is_found_with_its_key_named_in_the_context() {
        let paths = extract_ok("LOG=/var/log/x.log\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "/var/log/x.log");
        assert_eq!(paths[0].context, "Environment variable: LOG");
        assert_eq!(paths[0].position, Position { line: 1, column: 5 });
    }

    #[test]
    fn surrounding_quotes_are_stripped_from_the_value() {
        let paths = extract_ok("A=\"./cache\"\nB='./other'\n");
        assert_eq!(paths[0].value, "./cache");
        assert_eq!(paths[1].value, "./other");
    }

    #[test]
    fn escaped_backslashes_collapse() {
        let paths = extract_ok(r"WIN=C:\\Temp\\work");
        assert_eq!(paths[0].value, r"C:\Temp\work");
        assert_eq!(paths[0].kind, PathType::Absolute);
    }

    #[test]
    fn an_empty_value_is_not_an_assignment_worth_reporting() {
        assert!(extract_ok("EMPTY=\n").is_empty());
    }

    /// Both halves of a line can be paths, and the value comes first.
    #[test]
    fn a_path_like_key_emits_after_its_value() {
        let paths = extract_ok("\"./key.js\"=\"./value.js\"\n");
        assert_eq!(paths.len(), 2);
        assert_eq!(paths[0].value, "./value.js");
        assert_eq!(paths[0].context, "Environment variable: ./key.js");
        assert_eq!(paths[1].value, "./key.js");
        assert_eq!(paths[1].context, "Environment variable name");
        assert_eq!(paths[1].position.column, 2);
    }

    #[test]
    fn an_unquoted_path_like_key_starts_at_column_one() {
        let paths = extract_ok("./key.sh=enabled\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.column, 1);
    }

    /// The backreference is what makes the quote symmetric: an opening
    /// quote with no closing one is not a quoted key.
    #[test]
    fn an_unbalanced_quote_does_not_parse_as_a_quoted_key() {
        let paths = extract_ok("\"./key.js=./value.js\n");
        assert!(
            paths
                .iter()
                .all(|p| p.context != "Environment variable name"),
            "{paths:?}"
        );
    }

    #[test]
    fn columns_count_utf16_units_not_bytes() {
        let paths = extract_ok("Aé=/var/x.log\n");
        // `Aé` is three bytes and two code units, so the value starts
        // at column 4, not 5.
        assert_eq!(paths[0].position.column, 4);
    }

    #[test]
    fn a_line_without_an_assignment_is_skipped() {
        assert!(extract_ok("just some text\n").is_empty());
    }

    /// A carriage return is not a line break to `split('\n')`, so a
    /// CRLF file keeps its `\r` — and the trim removes it before the
    /// pattern ever sees it.
    #[test]
    fn crlf_lines_parse() {
        let paths = extract_ok("LOG=/var/log/x.log\r\nB=/b.txt\r\n");
        assert_eq!(paths.len(), 2);
        assert_eq!(paths[1].position.line, 2);
    }
}
