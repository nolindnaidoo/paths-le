//! `url()` and `@import` paths from CSS/SCSS/LESS.
//!
//! Whole-content matching; positions point at the path itself.
//! `@import` matches are recorded first and their spans claimed, so a
//! path inside `@import url(…)` is counted once rather than twice.

use std::sync::LazyLock;

use fancy_regex::Regex;

use super::position::PositionIndex;
use super::schemes::is_excluded_scheme;
use super::{Path, heuristics, js};

static IMPORT_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    let s = format!("[{}]", js::JS_SPACE_CLASS);
    compile(&format!(
        r#"(?i)@import{s}+(?:url{s}*\({s}*)?(['"])([^'"]+)\1(?:{s}*\))?"#
    ))
});

/// The optional quote is what makes this need a backreference rather
/// than an alternation: `(['"]?)…\1` matches `url(x)`, `url('x')` and
/// `url("x")` while rejecting `url('x")`.
static URL_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    let s = format!("[{}]", js::JS_SPACE_CLASS);
    compile(&format!(r#"(?i)url{s}*\({s}*(['"]?)([^'"()]+?)\1{s}*\)"#))
});

fn compile(pattern: &str) -> Regex {
    Regex::new(pattern).expect("a constant pattern compiles")
}

pub(crate) fn extract(content: &str) -> super::Extracted {
    if js::is_blank(content) {
        return Ok(Vec::new());
    }

    let index = PositionIndex::new(content);
    let mut paths = Vec::new();
    let mut claimed: Vec<usize> = Vec::new();

    for captures in IMPORT_PATTERN.captures_iter(content) {
        let captures = captures.map_err(|error| format!("the @import pattern gave up: {error}"))?;
        let Some(target) = captures.get(2) else {
            continue;
        };
        let value = js::trim(target.as_str());
        if value.is_empty() || is_excluded_scheme(value) {
            continue;
        }
        claimed.push(target.start());
        paths.push(Path {
            value: value.to_string(),
            kind: heuristics::classify_path_type(value),
            position: index.at(target.start()),
            context: "CSS @import".to_string(),
        });
    }

    for captures in URL_PATTERN.captures_iter(content) {
        let captures = captures.map_err(|error| format!("the url() pattern gave up: {error}"))?;
        let Some(target) = captures.get(2) else {
            continue;
        };
        let value = js::trim(target.as_str());
        if value.is_empty() || is_excluded_scheme(value) || claimed.contains(&target.start()) {
            continue;
        }
        paths.push(Path {
            value: value.to_string(),
            kind: heuristics::classify_path_type(value),
            position: index.at(target.start()),
            context: "CSS url()".to_string(),
        });
    }

    paths.sort_by(|a, b| {
        a.position
            .line
            .cmp(&b.position.line)
            .then(a.position.column.cmp(&b.position.column))
    });
    Ok(paths)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn extract_ok(content: &str) -> Vec<Path> {
        extract(content).expect("the patterns hold")
    }

    #[test]
    fn a_blank_document_yields_nothing() {
        assert!(extract_ok("").is_empty());
    }

    #[test]
    fn both_import_shapes_are_found() {
        let paths = extract_ok("@import './a.css';\n@import url(\"../b.css\");\n");
        assert_eq!(paths.len(), 2);
        assert!(paths.iter().all(|p| p.context == "CSS @import"));
        assert_eq!(paths[0].value, "./a.css");
        assert_eq!(paths[1].value, "../b.css");
    }

    /// A path inside `@import url(…)` is matched by both patterns; the
    /// claim is what stops it being reported twice.
    #[test]
    fn an_import_url_is_counted_once() {
        let paths = extract_ok("@import url(\"../b.css\");\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].context, "CSS @import");
    }

    #[test]
    fn url_accepts_all_three_quotings() {
        let paths = extract_ok(
            "a{background:url(a.png)}\nb{background:url('b.png')}\nc{background:url(\"c.png\")}\n",
        );
        let values: Vec<&str> = paths.iter().map(|p| p.value.as_str()).collect();
        assert_eq!(values, ["a.png", "b.png", "c.png"]);
    }

    /// The backreference makes the quoting symmetric — a mismatched
    /// pair is not a `url()` argument.
    #[test]
    fn mismatched_quotes_do_not_match() {
        assert!(extract_ok("a{background:url('x.png\")}").is_empty());
    }

    #[test]
    fn pseudo_schemes_are_excluded() {
        let paths = extract_ok(
            "a{background:url(data:image/png;base64,AAA)}\nb{background:url(JavaScript:void(0))}\n",
        );
        assert!(paths.is_empty(), "{paths:?}");
    }

    #[test]
    fn the_position_points_at_the_path() {
        let paths = extract_ok("body{background:url('/assets/x.jpg')}");
        assert_eq!(paths[0].position.line, 1);
        assert_eq!(paths[0].position.column, 22);
    }

    #[test]
    fn results_come_back_in_document_order() {
        let paths = extract_ok("a{background:url(z.png)}\n@import './a.css';\n");
        assert_eq!(paths[0].value, "z.png");
        assert_eq!(paths[1].value, "./a.css");
    }

    #[test]
    fn matching_is_case_insensitive() {
        let paths = extract_ok("@IMPORT './a.css';\na{background:URL(b.png)}\n");
        assert_eq!(paths.len(), 2);
    }
}
