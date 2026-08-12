//! Paths from YAML scalars, and from keys that look like paths.
//!
//! Read with `saphyr` where the extension reads with `js-yaml`. Two
//! parsers, one contract: they only have to agree on the *values* and
//! their order, because positions do not come from either of them. They
//! come from a forward-moving search over the source text, exactly as
//! TOML's do — repeated identical values resolve to successive
//! occurrences, and a value that cannot be located falls back to 1:1.
//!
//! That is a deliberate choice over `saphyr`'s markers, which `js-yaml`
//! has no equivalent of: a position derived from the parser here and
//! from a text search there would disagree on every quoted, folded or
//! anchored scalar, and the corpus would be pinning a coincidence.
//!
//! Keys count as well as values, because a YAML mapping keyed by path is
//! ordinary — a Kubernetes config map's `data:`, a compose file's
//! volumes. TOML does the same for the same reason.

use saphyr::{LoadableYamlNode, Scalar, Yaml};

use super::position::PositionIndex;
use super::{Path, Position, heuristics};

pub(crate) fn extract(content: &str) -> Vec<Path> {
    // A document that does not parse yields nothing, matching the
    // extension's `catch { return [] }` — the same answer TOML and JSON
    // give, so a broken document reads the same way whatever it is.
    let Ok(documents) = Yaml::load_from_str(content) else {
        return Vec::new();
    };

    let index = PositionIndex::new(content);
    let mut locator = Locator::new(content, &index);
    let mut paths = Vec::new();
    for document in &documents {
        walk(document, &mut paths, &mut locator);
    }
    paths
}

fn walk(node: &Yaml<'_>, paths: &mut Vec<Path>, locator: &mut Locator) {
    match node {
        Yaml::Value(Scalar::String(text)) => claim(text, "YAML value", paths, locator),
        Yaml::Sequence(items) => {
            for item in items {
                walk(item, paths, locator);
            }
        }
        Yaml::Mapping(entries) => {
            for (key, value) in entries {
                if let Yaml::Value(Scalar::String(text)) = key {
                    claim(text, "YAML key", paths, locator);
                }
                walk(value, paths, locator);
            }
        }
        // Numbers, booleans, nulls and anything still in its raw
        // representation are not strings, so there is no path in them.
        _ => {}
    }
}

fn claim(text: &str, context: &str, paths: &mut Vec<Path>, locator: &mut Locator) {
    if !heuristics::is_path_like(text) {
        return;
    }
    paths.push(Path {
        value: text.to_string(),
        kind: heuristics::classify_path_type(text),
        position: locator.locate(text),
        context: context.to_string(),
    });
}

/// Finds where a parsed scalar came from, moving forward through the
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
        if let Some(offset) = self.content[self.search_from..]
            .find(value)
            .map(|at| at + self.search_from)
        {
            self.search_from = offset + value.len();
            return self.index.at(offset);
        }
        // An anchor's value is expanded at every alias, so the same
        // string legitimately appears behind the cursor. Retrying from
        // the top answers with the definition rather than with 1:1,
        // without moving the cursor back.
        if let Some(anywhere) = self.content.find(value) {
            return self.index.at(anywhere);
        }
        Position { line: 1, column: 1 }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::PathType;

    fn values(content: &str) -> Vec<String> {
        extract(content)
            .into_iter()
            .map(|path| path.value)
            .collect()
    }

    #[test]
    fn a_blank_document_yields_nothing() {
        assert!(extract("").is_empty());
        assert!(extract("  \n ").is_empty());
    }

    #[test]
    fn a_document_that_does_not_parse_yields_nothing() {
        assert!(extract("a: [unterminated").is_empty());
    }

    #[test]
    fn a_scalar_value_is_a_path() {
        let paths = extract("log: /var/log/app.log\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "/var/log/app.log");
        assert_eq!(paths[0].kind, PathType::Absolute);
        assert_eq!(paths[0].context, "YAML value");
        assert_eq!(paths[0].position.line, 1);
        assert_eq!(paths[0].position.column, 6);
    }

    #[test]
    fn a_key_that_looks_like_a_path_counts_too() {
        let paths = extract("config/app.yaml: contents\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "config/app.yaml");
        assert_eq!(paths[0].context, "YAML key");
    }

    #[test]
    fn sequences_and_nesting_are_followed() {
        assert_eq!(
            values("jobs:\n  build:\n    steps:\n      - ./scripts/a.sh\n      - ./scripts/b.sh\n"),
            ["./scripts/a.sh", "./scripts/b.sh"]
        );
    }

    #[test]
    fn every_document_in_the_file_is_read() {
        assert_eq!(
            values("a: ./one.ts\n---\nb: ./two.ts\n"),
            ["./one.ts", "./two.ts"]
        );
    }

    /// The parser types its scalars, so a quoted number is a string and
    /// a bare one is not — and neither is a path either way.
    #[test]
    fn non_string_scalars_are_skipped() {
        assert!(values("port: 8080\nenabled: true\nempty: null\n").is_empty());
    }

    #[test]
    fn mapping_order_follows_the_document() {
        let paths = extract("z: ./first.ts\na: ./second.ts\n");
        assert_eq!(paths[0].value, "./first.ts");
        assert_eq!(paths[0].position.line, 1);
        assert_eq!(paths[1].value, "./second.ts");
        assert_eq!(paths[1].position.line, 2);
    }

    #[test]
    fn repeated_values_land_on_successive_occurrences() {
        let paths = extract("a: ./x.ts\nb: ./x.ts\n");
        assert_eq!(paths[0].position.line, 1);
        assert_eq!(paths[1].position.line, 2);
    }

    /// An alias expands to the anchor's value, which is behind the
    /// cursor by then. Answering with the definition is more useful than
    /// answering 1:1, and both are honest about where the text is.
    #[test]
    fn an_aliased_value_resolves_to_its_anchor() {
        let paths = extract("base: &dir ./shared/lib.ts\nuse: *dir\n");
        assert_eq!(paths.len(), 2);
        assert_eq!(paths[1].value, "./shared/lib.ts");
        assert_eq!(paths[1].position.line, 1);
    }

    /// The 1:1 fallback is reachable: a folded scalar holds a value that
    /// appears nowhere in the source as written.
    #[test]
    fn an_unlocatable_value_falls_back_to_the_first_position() {
        let paths = extract("p: >-\n  ./spread\n  /out.ts\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "./spread /out.ts");
        assert_eq!(paths[0].position, Position { line: 1, column: 1 });
    }

    #[test]
    fn a_quoted_scalar_is_located_past_its_quote() {
        let paths = extract("p: \"./quoted.ts\"\n");
        assert_eq!(paths[0].position.column, 5);
    }

    #[test]
    fn a_comment_is_not_a_value() {
        assert!(values("# see ./notes.md\na: 1\n").is_empty());
    }
}
