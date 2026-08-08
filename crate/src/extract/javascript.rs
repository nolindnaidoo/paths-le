//! Module specifiers from JavaScript/TypeScript source.
//!
//! Whole-content matching rather than per-line, so an import statement
//! spread across several lines is still found. Only module specifiers
//! are extracted — `import`/`export … from`, side-effect imports,
//! dynamic `import()` and `require()` — and package names (`react`,
//! `node:fs`, `@org/pkg`) are excluded by an allow-list of shapes.
//!
//! This is regex over source, not an AST walk. A specifier inside a
//! comment or a string literal is therefore extracted too. That is the
//! extension's behaviour, ported as it stands; SPEC.md lists it.

use std::sync::LazyLock;

use fancy_regex::{Captures, Regex};

use super::position::PositionIndex;
use super::{Path, heuristics, js};

/// The extension's four patterns, verbatim but for two substitutions:
/// `\s` becomes JavaScript's whitespace set spelled out, and the
/// backreferences stay backreferences — which is the reason this module
/// uses `fancy-regex` at all.
struct PatternSpec {
    pattern: Regex,
    context: fn(&Captures<'_, str>) -> String,
}

static PATTERNS: LazyLock<[PatternSpec; 4]> = LazyLock::new(|| {
    let s = format!("[{}]", js::JS_SPACE_CLASS);
    [
        PatternSpec {
            // import/export … from '…' — the statement head may span
            // lines; [^;'"`]*? cannot cross a string or statement
            // boundary.
            pattern: compile(&format!(
                r#"\b(import|export)\b[^;'"`]*?\bfrom{s}*(['"])([^'"\n]+)\2"#
            )),
            context: |captures| {
                format!(
                    "JS {}",
                    captures.get(1).map_or("import", |keyword| keyword.as_str())
                )
            },
        },
        PatternSpec {
            pattern: compile(&format!(r#"\bimport{s}*\({s}*(['"])([^'"\n]+)\1{s}*\)"#)),
            context: |_| "JS dynamic import".to_string(),
        },
        PatternSpec {
            pattern: compile(&format!(r#"\brequire{s}*\({s}*(['"])([^'"\n]+)\1{s}*\)"#)),
            context: |_| "JS require".to_string(),
        },
        PatternSpec {
            // side-effect import: import './x'
            pattern: compile(&format!(r#"\bimport{s}*(['"])([^'"\n]+)\1"#)),
            context: |_| "JS import".to_string(),
        },
    ]
});

fn compile(pattern: &str) -> Regex {
    Regex::new(pattern).expect("a constant pattern compiles")
}

pub(crate) fn extract(content: &str) -> super::Extracted {
    if js::is_blank(content) {
        return Ok(Vec::new());
    }

    let index = PositionIndex::new(content);
    let mut paths: Vec<Path> = Vec::new();
    let mut seen_offsets: Vec<usize> = Vec::new();

    for spec in PATTERNS.iter() {
        for captures in spec.pattern.captures_iter(content) {
            let captures =
                captures.map_err(|error| format!("a module-specifier pattern gave up: {error}"))?;
            // The path is always the last capture group.
            let Some(specifier) = captures.get(captures.len() - 1) else {
                continue;
            };
            if !is_module_path(specifier.as_str()) {
                continue;
            }
            let start = specifier.start();
            if seen_offsets.contains(&start) {
                continue;
            }
            seen_offsets.push(start);

            paths.push(Path {
                value: specifier.as_str().to_string(),
                kind: heuristics::classify_path_type(specifier.as_str()),
                position: index.at(start),
                context: (spec.context)(&captures),
            });
        }
    }

    // Patterns run in their own order, so the results have to be put
    // back into document order. `sort_by` is stable, as JavaScript's
    // sort has been since ES2019, so two paths at one position keep the
    // order the patterns produced them in.
    paths.sort_by(|a, b| {
        a.position
            .line
            .cmp(&b.position.line)
            .then(a.position.column.cmp(&b.position.column))
    });
    Ok(paths)
}

/// Module specifiers that are file paths rather than package names:
/// relative, absolute, drive-letter, or URL.
fn is_module_path(value: &str) -> bool {
    if value.encode_utf16().count() < 2 {
        return false;
    }
    value.starts_with("./")
        || value.starts_with("../")
        || value.starts_with('/')
        || is_drive_letter(value)
        || value.starts_with("http://")
        || value.starts_with("https://")
        || value.starts_with("file://")
}

fn is_drive_letter(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(letter) = chars.next() else {
        return false;
    };
    letter.is_ascii_alphabetic()
        && chars.next() == Some(':')
        && matches!(chars.next(), Some('/' | '\\'))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::PathType;

    fn extract_ok(content: &str) -> Vec<Path> {
        extract(content).expect("the patterns hold")
    }

    #[test]
    fn a_blank_document_yields_nothing() {
        assert!(extract_ok("").is_empty());
    }

    #[test]
    fn package_names_are_not_paths() {
        let paths = extract_ok(
            "import fs from 'node:fs';\nimport react from 'react';\nimport x from '@org/pkg';\n",
        );
        assert!(paths.is_empty(), "{paths:?}");
    }

    #[test]
    fn each_statement_shape_gets_its_own_context() {
        let paths = extract_ok(
            "import a from './a.js';\nexport { b } from './b.js';\nimport('./c.js');\nrequire('./d.js');\nimport './e.js';\n",
        );
        let contexts: Vec<&str> = paths.iter().map(|p| p.context.as_str()).collect();
        assert_eq!(
            contexts,
            [
                "JS import",
                "JS export",
                "JS dynamic import",
                "JS require",
                "JS import"
            ]
        );
    }

    /// The statement head may span lines — the character class matches
    /// newlines, which is what makes a multi-line import reachable.
    #[test]
    fn a_multiline_import_is_found() {
        let paths = extract_ok("import {\n  alpha,\n  beta,\n} from './target.js';\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 4);
        assert_eq!(paths[0].value, "./target.js");
    }

    /// A side-effect import is also matched by the `from` pattern's
    /// sibling, so without the offset dedupe it would appear twice.
    #[test]
    fn one_specifier_is_reported_once() {
        let paths = extract_ok("import './e.js';\n");
        assert_eq!(paths.len(), 1);
    }

    #[test]
    fn results_come_back_in_document_order() {
        let paths = extract_ok("require('./z.js');\nimport './a.js';\n");
        assert_eq!(paths[0].value, "./z.js");
        assert_eq!(paths[1].value, "./a.js");
    }

    #[test]
    fn absolute_drive_and_url_specifiers_all_count() {
        let paths = extract_ok(
            "import '/abs/x.js';\nimport 'C:\\\\a\\\\b.js';\nimport 'https://cdn/x.js';\nimport 'file:///opt/x.bin';\n",
        );
        let kinds: Vec<PathType> = paths.iter().map(|p| p.kind).collect();
        assert_eq!(
            kinds,
            [
                PathType::Absolute,
                PathType::Absolute,
                PathType::Url,
                PathType::Url
            ]
        );
    }

    /// Source escapes are not interpreted: the specifier is reported
    /// exactly as written between the quotes.
    #[test]
    fn escapes_are_left_as_written() {
        let paths = extract_ok(r"const p = require('C:\\Program Files\\app\\main.js');");
        assert_eq!(paths[0].value, r"C:\\Program Files\\app\\main.js");
    }

    #[test]
    fn a_string_that_is_not_a_specifier_is_ignored() {
        assert!(extract_ok("const notAnImport = '/etc/hosts';").is_empty());
    }

    #[test]
    fn a_single_character_specifier_is_rejected() {
        assert!(extract_ok("import '/';").is_empty());
    }

    #[test]
    fn drive_letters_need_a_separator() {
        assert!(is_module_path(r"C:\a"));
        assert!(is_module_path("C:/a"));
        assert!(!is_module_path("C:a"));
        assert!(!is_module_path("1:/a"));
    }
}
