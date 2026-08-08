//! Paths from HTML attributes (`src`, `href`, `srcset`, `action`, …).
//!
//! Whole-content matching, so an attribute inside a multi-line tag is
//! found; positions point at the attribute value. `srcset` is split so
//! every candidate in it gets its own real position rather than all of
//! them pointing at the attribute.

use std::sync::LazyLock;

use fancy_regex::Regex;

use super::position::PositionIndex;
use super::schemes::is_excluded_scheme;
use super::{Path, heuristics, js};

static ATTRIBUTE_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    let s = format!("[{}]", js::JS_SPACE_CLASS);
    Regex::new(&format!(
        r#"(?i)\b(src|href|data|action|poster|background|cite|formaction|icon|manifest|srcset){s}*={s}*(["'])([^"']+)\2"#
    ))
    .expect("a constant pattern compiles")
});

pub(crate) fn extract(content: &str) -> super::Extracted {
    if js::is_blank(content) {
        return Ok(Vec::new());
    }

    let index = PositionIndex::new(content);
    let mut paths = Vec::new();

    for captures in ATTRIBUTE_PATTERN.captures_iter(content) {
        let captures =
            captures.map_err(|error| format!("the attribute pattern gave up: {error}"))?;
        let (Some(name), Some(value)) = (captures.get(1), captures.get(3)) else {
            continue;
        };
        let attribute = name.as_str().to_lowercase();

        if attribute == "srcset" {
            extract_srcset(value.as_str(), value.start(), &mut paths, &index);
            continue;
        }

        if is_excluded_scheme(value.as_str()) {
            continue;
        }

        paths.push(Path {
            value: value.as_str().to_string(),
            kind: heuristics::classify_path_type(value.as_str()),
            position: index.at(value.start()),
            context: format!("HTML {attribute}"),
        });
    }
    Ok(paths)
}

/// `srcset` holds several candidates with descriptors —
/// `image1.jpg 1x, image2.jpg 2x`. Each entry's offset is computed
/// within the attribute value, so every candidate reports where it
/// actually is.
fn extract_srcset(srcset: &str, base_offset: usize, paths: &mut Vec<Path>, index: &PositionIndex) {
    let mut cursor = 0;
    for entry in srcset.split(',') {
        let leading = entry.len() - js::trim_start(entry).len();
        let candidate = js::first_token(js::trim(entry));
        if !candidate.is_empty() && !is_excluded_scheme(candidate) {
            paths.push(Path {
                value: candidate.to_string(),
                kind: heuristics::classify_path_type(candidate),
                position: index.at(base_offset + cursor + leading),
                context: "HTML srcset".to_string(),
            });
        }
        cursor += entry.len() + 1; // +1 for the comma
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn extract_ok(content: &str) -> Vec<Path> {
        extract(content).expect("the pattern holds")
    }

    #[test]
    fn a_blank_document_yields_nothing() {
        assert!(extract_ok("").is_empty());
    }

    #[test]
    fn the_attribute_name_becomes_the_context_lowercased() {
        let paths = extract_ok("<a HREF=\"./a.html\"></a>");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].context, "HTML href");
    }

    #[test]
    fn every_listed_attribute_is_matched() {
        let html = "<x src='a.png' href='b.html' data='c.bin' action='d.php' poster='e.jpg' \
                    background='f.png' cite='g.html' formaction='h.php' icon='i.ico' \
                    manifest='j.json'>";
        assert_eq!(extract_ok(html).len(), 10);
    }

    #[test]
    fn an_attribute_in_a_multiline_tag_is_found() {
        let paths = extract_ok("<img\n\tsrc=\"./split/lines.png\"\n\talt=\"x\">");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 2);
    }

    #[test]
    fn each_srcset_candidate_gets_its_own_position() {
        let paths = extract_ok("<img srcset=\"a.png 1x, b.png 2x\">");
        assert_eq!(paths.len(), 2);
        assert_eq!(paths[0].value, "a.png");
        assert_eq!(paths[1].value, "b.png");
        assert!(
            paths[1].position.column > paths[0].position.column,
            "{paths:?}"
        );
        assert!(paths.iter().all(|p| p.context == "HTML srcset"));
    }

    #[test]
    fn a_srcset_entry_keeps_its_descriptor_out_of_the_value() {
        let paths = extract_ok("<img srcset=\"a.png 1200w\">");
        assert_eq!(paths[0].value, "a.png");
    }

    #[test]
    fn pseudo_schemes_are_excluded() {
        let paths = extract_ok(
            "<a href=\"javascript:void(0)\">x</a><img src=\"data:image/gif;base64,R0lGOD=\">",
        );
        assert!(paths.is_empty(), "{paths:?}");
    }

    /// A `data:` URI inside `srcset` contains a comma, and `srcset` is
    /// split on commas before the scheme check runs — so the base64
    /// tail survives as a candidate. The extension does exactly this;
    /// verified against it, ported rather than fixed, and listed in
    /// SPEC.md. `fixtures/documents/srcset-data-uri.html` pins it on
    /// both sides.
    #[test]
    fn a_data_uri_inside_srcset_splits_on_its_own_comma() {
        let paths = extract_ok("<img srcset=\"data:image/gif;base64,R0lGOD= 1x\">");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "R0lGOD=");
        assert_eq!(paths[0].context, "HTML srcset");
        assert_eq!(paths[0].position.column, 36);
    }

    #[test]
    fn the_position_points_at_the_value_not_the_attribute() {
        let paths = extract_ok("<img src=\"a.png\">");
        assert_eq!(paths[0].position.column, 11);
    }

    /// The backreference makes the quoting symmetric, so a value that
    /// opens with one quote and closes with the other is not matched.
    #[test]
    fn mismatched_quotes_do_not_match() {
        assert!(extract_ok("<img src=\"a.png'>").is_empty());
    }

    #[test]
    fn results_stay_in_document_order() {
        let paths = extract_ok("<img src=\"a.png\"><img src=\"b.png\">");
        assert_eq!(paths[0].value, "a.png");
        assert_eq!(paths[1].value, "b.png");
    }
}
