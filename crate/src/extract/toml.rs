//! Paths from TOML values, and from keys that look like paths.
//!
//! The parser exposes no source offsets for values, so positions come
//! from a forward-moving search over the source text: exact match
//! first, then the backslash-escaped form for Windows paths inside
//! basic strings. Repeated identical values resolve to successive
//! occurrences; a value that cannot be located falls back to 1:1.
//!
//! That is the extension's design, ported including its weaknesses,
//! because a position derived any other way would disagree with it.
//!
//! Table iteration must follow the document, not the alphabet — see the
//! `preserve_order` note in Cargo.toml.

use super::js;
use super::position::PositionIndex;
use super::{Path, Position, heuristics};

pub(crate) fn extract(content: &str) -> Vec<Path> {
    if js::is_blank(content) {
        return Vec::new();
    }

    // `Table`, not `Value`: `Value`'s parser reads a single TOML value
    // expression, so a document starting with a table header parses as
    // an array and then reports the rest as trailing junk. A TOML
    // document is always a table.
    //
    // A document that does not parse yields nothing, matching the
    // extension's `catch { return [] }`.
    let Ok(parsed) = content.parse::<::toml::Table>() else {
        return Vec::new();
    };

    let index = PositionIndex::new(content);
    let mut locator = Locator::new(content, &index);
    let mut paths = Vec::new();
    walk(&::toml::Value::Table(parsed), &mut paths, &mut locator);
    paths
}

fn walk(value: &::toml::Value, paths: &mut Vec<Path>, locator: &mut Locator) {
    match value {
        ::toml::Value::String(text) => {
            if heuristics::is_path_like(text) {
                paths.push(Path {
                    value: text.clone(),
                    kind: heuristics::classify_path_type(text),
                    position: locator.locate(text),
                    context: "TOML value".to_string(),
                });
            }
        }
        ::toml::Value::Array(items) => {
            for item in items {
                walk(item, paths, locator);
            }
        }
        ::toml::Value::Table(table) => {
            for (key, value) in table {
                if heuristics::is_path_like(key) {
                    paths.push(Path {
                        value: key.clone(),
                        kind: heuristics::classify_path_type(key),
                        position: locator.locate(key),
                        context: "TOML key".to_string(),
                    });
                }
                walk(value, paths, locator);
            }
        }
        _ => {}
    }
}

/// Finds where a parsed value came from, moving forward through the
/// source so repeated values land on successive occurrences.
struct Locator<'a> {
    content: &'a str,
    index: &'a PositionIndex<'a>,
    search_from: usize,
}

impl<'a> Locator<'a> {
    fn new(content: &'a str, index: &'a PositionIndex<'a>) -> Self {
        Self {
            content,
            index,
            search_from: 0,
        }
    }

    fn locate(&mut self, value: &str) -> Position {
        let escaped = value.replace('\\', r"\\");
        for candidate in [value, escaped.as_str()] {
            if let Some(offset) = self.content[self.search_from..]
                .find(candidate)
                .map(|at| at + self.search_from)
            {
                self.search_from = offset + candidate.len();
                return self.index.at(offset);
            }
            // Occurrences can appear before the cursor when table order
            // differs from source order — retry from the top, without
            // moving the cursor back.
            if let Some(anywhere) = self.content.find(candidate) {
                return self.index.at(anywhere);
            }
        }
        Position { line: 1, column: 1 }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::PathType;

    #[test]
    fn a_blank_document_yields_nothing() {
        assert!(extract("").is_empty());
        assert!(extract("  \n ").is_empty());
    }

    #[test]
    fn a_document_that_does_not_parse_yields_nothing() {
        assert!(extract("this is [not toml").is_empty());
    }

    #[test]
    fn values_and_keys_both_count() {
        let paths = extract("[\"./key.sh\"]\nvalue = \"./value.sh\"\n");
        assert_eq!(paths.len(), 2);
        assert_eq!(paths[0].value, "./key.sh");
        assert_eq!(paths[0].context, "TOML key");
        assert_eq!(paths[1].value, "./value.sh");
        assert_eq!(paths[1].context, "TOML value");
    }

    #[test]
    fn arrays_are_walked() {
        let paths = extract("files = [\"./a.ts\", \"./b.ts\"]\n");
        assert_eq!(paths.len(), 2);
        assert_eq!(paths[1].value, "./b.ts");
    }

    /// Table order must follow the document. With an alphabetical map
    /// this test reports the `z` table first and every position after
    /// it is wrong.
    #[test]
    fn tables_iterate_in_document_order() {
        let paths = extract("[z]\na = \"./first.ts\"\n\n[a]\nb = \"./second.ts\"\n");
        assert_eq!(paths[0].value, "./first.ts");
        assert_eq!(paths[0].position.line, 2);
        assert_eq!(paths[1].value, "./second.ts");
        assert_eq!(paths[1].position.line, 5);
    }

    #[test]
    fn repeated_values_land_on_successive_occurrences() {
        let paths = extract("a = \"./x.ts\"\nb = \"./x.ts\"\n");
        assert_eq!(paths[0].position.line, 1);
        assert_eq!(paths[1].position.line, 2);
    }

    /// A basic string holding a Windows path is escaped in the source
    /// but unescaped once parsed, so the raw value is not findable and
    /// the escaped form is what gets located.
    #[test]
    fn a_windows_path_is_located_through_its_escaped_form() {
        let paths = extract(r#"p = "C:\\Temp\\x.txt""#);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, r"C:\Temp\x.txt");
        assert_eq!(paths[0].kind, PathType::Absolute);
        assert_eq!(paths[0].position.column, 6);
    }

    /// A literal string needs no escaping, so the value is found as
    /// written and the escaped candidate never runs.
    #[test]
    fn a_literal_string_is_located_directly() {
        let paths = extract(r"p = 'C:\Temp\x.txt'");
        assert_eq!(paths[0].value, r"C:\Temp\x.txt");
        assert_eq!(paths[0].position.column, 6);
    }

    /// The 1:1 fallback is reachable: a multi-line basic string holds a
    /// value that appears nowhere in the source as written.
    #[test]
    fn an_unlocatable_value_falls_back_to_the_first_position() {
        let paths = extract("p = \"\"\"\n./spread\\\n  /out.ts\"\"\"\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position, Position { line: 1, column: 1 });
    }

    #[test]
    fn non_string_values_are_skipped() {
        let paths = extract("a = 1\nb = true\nc = 1979-05-27\nd = \"./x.ts\"\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "./x.ts");
    }
}
