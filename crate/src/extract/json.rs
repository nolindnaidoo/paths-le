//! Paths from JSON/JSONC string values.
//!
//! The parser tolerates comments and trailing commas, so a `.jsonc`
//! document extracts instead of silently returning nothing, and it
//! carries real node ranges so positions come from the parse rather
//! than from a text search.
//!
//! Parser leniency is pinned to what the extension's parser accepts,
//! not to what this one offers by default: single-quoted strings,
//! unquoted property names, missing commas, hexadecimal numbers and
//! unary plus are all switched **off**, because accepting them here
//! would extract paths from documents the extension reports nothing
//! for.

use jsonc_parser::ast::{Object, Value};
use jsonc_parser::{CollectOptions, ParseOptions, parse_to_ast};

use super::js;
use super::position::PositionIndex;
use super::{Path, heuristics};

const REFUSED: &str = "Invalid JSON: the document does not parse";

pub(crate) fn extract(content: &str) -> super::Extracted {
    if js::is_blank(content) {
        return Ok(Vec::new());
    }

    let options = ParseOptions {
        allow_comments: true,
        allow_trailing_commas: true,
        allow_loose_object_property_names: false,
        allow_missing_commas: false,
        allow_single_quoted_strings: false,
        allow_hexadecimal_numbers: false,
        allow_unary_plus_numbers: false,
    };
    // A document that does not parse is refused and named. It used to
    // yield nothing, which is also what a clean document yields, so a
    // file holding `/etc/passwd` behind a syntax error read as clean.
    // The extension refuses the same documents with the same words; the
    // corpus and the differential hold the two equal. A document holding
    // comments and nothing else has no value and is empty, not broken.
    let Ok(result) = parse_to_ast(content, &CollectOptions::default(), &options) else {
        return Err(REFUSED.to_string());
    };
    let Some(root) = result.value else {
        return Ok(Vec::new());
    };

    let index = PositionIndex::new(content);
    let mut paths = Vec::new();
    visit(&root, &mut Vec::new(), &mut paths, &index);
    Ok(paths)
}

fn visit(value: &Value, key_path: &mut Vec<String>, paths: &mut Vec<Path>, index: &PositionIndex) {
    match value {
        Value::StringLit(literal) => {
            let text = literal.value.as_ref();
            if !heuristics::is_path_like(text) {
                return;
            }
            paths.push(Path {
                value: text.to_string(),
                kind: heuristics::classify_path_type(text),
                // +1 skips the opening quote so the position points at
                // the path rather than at the string that holds it.
                position: index.at(literal.range.start + 1),
                context: format!(
                    "JSON {}",
                    if key_path.is_empty() {
                        "value".to_string()
                    } else {
                        key_path.join(".")
                    }
                ),
            });
        }
        Value::Array(array) => {
            for (position, element) in array.elements.iter().enumerate() {
                key_path.push(format!("[{position}]"));
                visit(element, key_path, paths, index);
                key_path.pop();
            }
        }
        Value::Object(object) => visit_object(object, key_path, paths, index),
        _ => {}
    }
}

fn visit_object(
    object: &Object,
    key_path: &mut Vec<String>,
    paths: &mut Vec<Path>,
    index: &PositionIndex,
) {
    for property in &object.properties {
        key_path.push(property.name.as_str().to_string());
        visit(&property.value, key_path, paths, index);
        key_path.pop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::PathType;

    /// The paths of a document that reads; a refusal fails the test by name.
    fn read(content: &str) -> Vec<Path> {
        extract(content).expect("the document reads")
    }

    #[test]
    fn a_blank_document_yields_nothing() {
        assert!(read("").is_empty());
        assert!(read("   \n\t ").is_empty());
    }

    /// Named, never silent: an empty result is what a clean document
    /// answers, and a document holding a path behind a syntax error used
    /// to answer exactly that.
    #[test]
    fn a_document_that_does_not_parse_is_refused_and_named() {
        assert_eq!(extract("{ this is not json"), Err(REFUSED.to_string()));
        assert_eq!(
            extract("{\"a\": \"./x.ts\", \"b\": "),
            Err(REFUSED.to_string()),
            "cut off mid-value"
        );
    }

    /// Comments and nothing else is a document with no value, not a broken
    /// one. The extension's parser reports the value it expected there;
    /// this one answers no value; both read it as empty.
    #[test]
    fn a_document_that_is_only_comments_is_empty_not_broken() {
        assert!(read("// nothing here").is_empty());
        assert!(read("/* nothing */").is_empty());
    }

    #[test]
    fn the_position_points_past_the_opening_quote() {
        let paths = read("{\"a\": \"./x.ts\"}");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 1);
        assert_eq!(paths[0].position.column, 8);
    }

    #[test]
    fn nested_keys_build_a_dotted_context() {
        let paths = read(r#"{"a":{"b":{"c":"./x.ts"}}}"#);
        assert_eq!(paths[0].context, "JSON a.b.c");
    }

    #[test]
    fn array_elements_are_indexed_in_the_context() {
        let paths = read(r#"{"files":["./a.ts","./b.ts"]}"#);
        assert_eq!(paths[0].context, "JSON files.[0]");
        assert_eq!(paths[1].context, "JSON files.[1]");
    }

    /// A bare string document has no key to name, so the context says
    /// what it is rather than leaving an empty suffix.
    #[test]
    fn a_root_string_is_named_value() {
        let paths = read("\"./root.ts\"");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].context, "JSON value");
    }

    #[test]
    fn non_string_leaves_are_skipped() {
        let paths = read(r#"{"a":42,"b":null,"c":true,"d":"./x.ts"}"#);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "./x.ts");
    }

    #[test]
    fn comments_and_trailing_commas_parse() {
        let paths = read("{\n// a comment\n\"a\": \"./x.ts\",\n}");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 3);
    }

    /// Leniency this parser offers by default and the extension's does
    /// not. Accepting it would extract from documents the extension
    /// reports nothing for, which is a parity break in the direction
    /// nobody would notice.
    #[test]
    fn leniency_beyond_the_extensions_parser_is_switched_off() {
        assert!(extract("{'a': './x.ts'}").is_err(), "single quotes");
        assert!(extract("{a: \"./x.ts\"}").is_err(), "unquoted key");
        assert!(
            extract("{\"a\": \"./x.ts\" \"b\": \"./y.ts\"}").is_err(),
            "missing comma"
        );
    }

    #[test]
    fn escapes_are_decoded_in_the_value() {
        let paths = read(r#"{"a":"C:\\Temp\\x.txt"}"#);
        assert_eq!(paths[0].value, r"C:\Temp\x.txt");
        assert_eq!(paths[0].kind, PathType::Absolute);
    }
}
