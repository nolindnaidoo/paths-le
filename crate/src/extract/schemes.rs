//! Pseudo-schemes that are never file paths.
//!
//! Matched case-insensitively and past leading whitespace because HTML
//! attribute values and CSS `url()` arguments are neither
//! case-normalised nor trimmed by the parsers — `JavaScript:` and
//! ` vbscript:` are both valid in markup and were previously extracted
//! as paths. That was a real finding in the extension (`CodeQL`
//! `js/incomplete-url-scheme-check`), not a hypothetical.
//!
//! Defined once rather than per-extractor: the HTML and CSS extractors
//! each carried an identical copy, with comments pointing at each other.
//!
//! The JavaScript extractor does not use this and does not need to: it
//! works from an allow-list of shapes that count as module paths, so an
//! unrecognised scheme is excluded by construction.

use std::sync::LazyLock;

use regex::Regex;

static NON_PATH_SCHEME: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"^(?i)[{}]*(?:data|javascript|vbscript):",
        super::js::JS_SPACE_CLASS
    ))
    .expect("a constant pattern compiles")
});

pub(crate) fn is_excluded_scheme(value: &str) -> bool {
    NON_PATH_SCHEME.is_match(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_three_schemes_are_excluded() {
        assert!(is_excluded_scheme("data:image/png;base64,AAA"));
        assert!(is_excluded_scheme("javascript:void(0)"));
        assert!(is_excluded_scheme("vbscript:msgbox"));
    }

    #[test]
    fn case_and_leading_whitespace_do_not_evade_it() {
        assert!(is_excluded_scheme("JavaScript:void(0)"));
        assert!(is_excluded_scheme(" vbscript:x"));
        assert!(is_excluded_scheme("\t\nDATA:x"));
    }

    #[test]
    fn real_paths_and_real_schemes_pass() {
        assert!(!is_excluded_scheme("./a/b.png"));
        assert!(!is_excluded_scheme("https://example.com"));
        assert!(!is_excluded_scheme("file:///a"));
        assert!(!is_excluded_scheme("metadata:not-a-scheme"));
    }

    /// The whitespace skip uses JavaScript's set, so a byte-order mark
    /// before the scheme does not smuggle it past the check.
    #[test]
    fn a_byte_order_mark_does_not_evade_it() {
        assert!(is_excluded_scheme("\u{feff}javascript:void(0)"));
    }
}
