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

pub(crate) fn extract(content: &str) -> Vec<Path> {
    if js::is_blank(content) {
        return Vec::new();
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
    // A document that does not parse yields nothing, matching the
    // extension: its parser returns no tree and the extractor returns
    // an empty list. Reporting the parse failure would be more useful
    // and is deliberately not done here — parity is the contract, and
    // the divergence would be invisible to the corpus.
    let Ok(result) = parse_to_ast(content, &CollectOptions::default(), &options) else {
        return Vec::new();
    };
    let Some(root) = result.value else {
        return Vec::new();
    };

    let index = PositionIndex::new(content);
    let mut paths = Vec::new();
    visit(&root, &mut Vec::new(), &mut paths, &index);
    paths
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

    #[test]
    fn a_blank_document_yields_nothing() {
        assert!(extract("").is_empty());
        assert!(extract("   \n\t ").is_empty());
    }

    #[test]
    fn a_document_that_does_not_parse_yields_nothing() {
        assert!(extract("{ this is not json").is_empty());
    }

    #[test]
    fn the_position_points_past_the_opening_quote() {
        let paths = extract("{\"a\": \"./x.ts\"}");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 1);
        assert_eq!(paths[0].position.column, 8);
    }

    #[test]
    fn nested_keys_build_a_dotted_context() {
        let paths = extract(r#"{"a":{"b":{"c":"./x.ts"}}}"#);
        assert_eq!(paths[0].context, "JSON a.b.c");
    }

    #[test]
    fn array_elements_are_indexed_in_the_context() {
        let paths = extract(r#"{"files":["./a.ts","./b.ts"]}"#);
        assert_eq!(paths[0].context, "JSON files.[0]");
        assert_eq!(paths[1].context, "JSON files.[1]");
    }

    /// A bare string document has no key to name, so the context says
    /// what it is rather than leaving an empty suffix.
    #[test]
    fn a_root_string_is_named_value() {
        let paths = extract("\"./root.ts\"");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].context, "JSON value");
    }

    #[test]
    fn non_string_leaves_are_skipped() {
        let paths = extract(r#"{"a":42,"b":null,"c":true,"d":"./x.ts"}"#);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "./x.ts");
    }

    #[test]
    fn comments_and_trailing_commas_parse() {
        let paths = extract("{\n// a comment\n\"a\": \"./x.ts\",\n}");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 3);
    }

    /// Leniency this parser offers by default and the extension's does
    /// not. Accepting it would extract from documents the extension
    /// reports nothing for, which is a parity break in the direction
    /// nobody would notice.
    #[test]
    fn leniency_beyond_the_extensions_parser_is_switched_off() {
        assert!(extract("{'a': './x.ts'}").is_empty(), "single quotes");
        assert!(extract("{a: \"./x.ts\"}").is_empty(), "unquoted key");
        assert!(
            extract("{\"a\": \"./x.ts\" \"b\": \"./y.ts\"}").is_empty(),
            "missing comma"
        );
    }

    #[test]
    fn escapes_are_decoded_in_the_value() {
        let paths = extract(r#"{"a":"C:\\Temp\\x.txt"}"#);
        assert_eq!(paths[0].value, r"C:\Temp\x.txt");
        assert_eq!(paths[0].kind, PathType::Absolute);
    }
}
