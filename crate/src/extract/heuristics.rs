//! The single path heuristic every format extractor shares.
//!
//! Strongly-structured candidates (absolute, relative, drive-letter,
//! URL) may contain spaces — the input is always an already-delimited
//! token (a JSON string, an env value, a CSV cell). Weakly-structured
//! candidates (bare `name.ext`, `dir/file`) must not contain
//! whitespace, and `name.ext` must not be purely numeric, which is what
//! keeps version strings (1.8.1) and IP addresses out of the results.
//!
//! Known limitation, ported deliberately: a bare domain
//! (`example.com`) still matches `name.ext`, being indistinguishable
//! from a filename without a TLD list. `fixtures/heuristics.json` pins
//! it on both sides so it cannot be "fixed" on one only.

use std::sync::LazyLock;

use regex::Regex;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum PathType {
    File,
    Relative,
    Absolute,
    Url,
    Unknown,
}

const FORBIDDEN: &str = "\"'<>|*?";

/// `[^"'<>|*?]` — forbidden characters only, whitespace allowed.
const NOT_FORBIDDEN: &str = r#"[^"'<>|*?]"#;

/// `[^\s"'<>|*?]`, with JavaScript's `\s` rather than `regex`'s. The
/// difference is real and reachable — see `js::JS_SPACE_CLASS`.
fn not_forbidden_or_space() -> String {
    format!(r#"[^{}"'<>|*?]"#, super::js::JS_SPACE_CLASS)
}

static STRONG_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    let free = NOT_FORBIDDEN;
    let tight = not_forbidden_or_space();
    [
        format!(r"^/{free}+$"),              // Unix absolute
        format!(r"^[A-Za-z]:[\\/]{free}*$"), // Windows drive
        format!(r"^\.\.?/{free}+$"),         // relative
        format!(r"^https?://{tight}+$"),     // URL (no spaces)
        format!(r"^file://{tight}+$"),       // file URL (no spaces)
    ]
    .iter()
    .map(|pattern| Regex::new(pattern).expect("a constant pattern compiles"))
    .collect()
});

static WEAK_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    let tight = not_forbidden_or_space();
    [
        format!(r"^{tight}+\.[a-zA-Z0-9]+$"), // name.ext
        format!(r"^{tight}+/{tight}+$"),      // dir/file
    ]
    .iter()
    .map(|pattern| Regex::new(pattern).expect("a constant pattern compiles"))
    .collect()
});

/// `[\d.]` with JavaScript's `\d`, which is ASCII-only. `regex`'s `\d`
/// is the Unicode `Nd` category, so an Arabic-Indic digit would take a
/// different branch here than it does in the extension.
static NUMERIC_DOTTED: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[0-9.]+$").expect("a constant pattern compiles"));

static WINDOWS_DRIVE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[A-Za-z]:[\\/]").expect("a constant pattern compiles"));

pub(crate) fn is_path_like(value: &str) -> bool {
    // Length is UTF-16 code units in the extension (`String.length`),
    // and the guard rejects anything under two — so a single astral
    // character, which is one scalar but two code units, is kept by
    // both. Counting scalars here would drop it.
    if value.encode_utf16().count() < 2 {
        return false;
    }
    if value.contains(|c| FORBIDDEN.contains(c)) {
        return false;
    }
    if STRONG_PATTERNS
        .iter()
        .any(|pattern| pattern.is_match(value))
    {
        return true;
    }
    if NUMERIC_DOTTED.is_match(value) {
        return false;
    }
    WEAK_PATTERNS.iter().any(|pattern| pattern.is_match(value))
}

pub(crate) fn classify_path_type(path: &str) -> PathType {
    if path.starts_with("http://")
        || path.starts_with("https://")
        || path.starts_with("file://")
        || (path.starts_with("//") && !path.starts_with("///"))
    {
        return PathType::Url;
    }
    if path.starts_with('#') {
        return PathType::Unknown;
    }
    if path.starts_with('/') || WINDOWS_DRIVE.is_match(path) {
        return PathType::Absolute;
    }
    if path.starts_with("./") || path.starts_with("../") {
        return PathType::Relative;
    }
    if path.contains('.') {
        return PathType::File;
    }
    PathType::Unknown
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strong_candidates_may_contain_spaces() {
        assert!(is_path_like("/path/with space/file.txt"));
        assert!(is_path_like(r"C:\Program Files\app.exe"));
        assert!(is_path_like("./dir with space/x.md"));
    }

    #[test]
    fn weak_candidates_may_not() {
        assert!(!is_path_like("has space/file.txt"));
        assert!(!is_path_like("has space.txt"));
    }

    #[test]
    fn a_url_may_not_contain_spaces_even_though_it_is_strong() {
        assert!(!is_path_like("https://example.com/a b"));
        assert!(is_path_like("https://example.com/a-b"));
    }

    #[test]
    fn version_strings_and_addresses_are_not_paths() {
        assert!(!is_path_like("1.8.1"));
        assert!(!is_path_like("192.168.1.1"));
        assert!(!is_path_like("3.4.5"));
    }

    /// The numeric guard runs after the strong patterns, so a path that
    /// happens to be all digits and dots still counts when it is
    /// structured.
    #[test]
    fn a_structured_numeric_path_survives_the_numeric_guard() {
        assert!(is_path_like("/1.2.3"));
        assert!(is_path_like("./1.2.3"));
    }

    #[test]
    fn forbidden_characters_reject_anywhere() {
        for forbidden in ['"', '\'', '<', '>', '|', '*', '?'] {
            let value = format!("/tmp/a{forbidden}b.txt");
            assert!(!is_path_like(&value), "{value}");
        }
    }

    #[test]
    fn anything_shorter_than_two_units_is_rejected() {
        assert!(!is_path_like(""));
        assert!(!is_path_like("a"));
        assert!(!is_path_like("/"));
    }

    /// One astral character is two UTF-16 code units, so it passes the
    /// length guard the way it does in the extension — and then fails
    /// on shape, which is a different reason.
    #[test]
    fn an_astral_character_passes_the_length_guard() {
        assert!(!is_path_like("🎯"));
        assert!(is_path_like("🎯/a"));
    }

    /// U+FEFF is whitespace to JavaScript and not to Unicode. The weak
    /// patterns must reject it, or a document with a stray byte-order
    /// mark extracts differently on each side.
    #[test]
    fn a_byte_order_mark_counts_as_whitespace() {
        assert!(!is_path_like("dir/\u{feff}file.txt"));
        assert!(!is_path_like("na\u{feff}me.txt"));
    }

    /// U+0085 is whitespace to Unicode and not to JavaScript, so it
    /// must NOT reject — the mirror image of the case above.
    #[test]
    fn a_next_line_character_does_not_count_as_whitespace() {
        assert!(is_path_like("na\u{85}me.txt"));
    }

    /// `regex`'s `\d` is every Unicode decimal digit; JavaScript's is
    /// ASCII, so the guard is spelled `[0-9.]` rather than `[\d.]`.
    ///
    /// The difference is currently unobservable: for it to change an
    /// answer, a value would have to be entirely non-ASCII digits and
    /// dots *and* match a weak pattern, and both weak patterns need
    /// either an ASCII-alphanumeric extension or a `/`. Both spellings
    /// therefore reject the value below, for different reasons. The
    /// ASCII spelling is kept because widening the extension class —
    /// a plausible future change — would make it observable, and a
    /// silent behaviour split between the two frontends is exactly what
    /// the corpus cannot catch.
    #[test]
    fn the_numeric_guard_is_ascii_only() {
        assert!(!is_path_like("\u{660}.\u{661}"));
        assert!(!NUMERIC_DOTTED.is_match("\u{660}.\u{661}"));
        assert!(NUMERIC_DOTTED.is_match("1.8.1"));
    }

    #[test]
    fn the_bare_domain_limitation_is_ported_deliberately() {
        assert!(is_path_like("example.com"));
        assert_eq!(classify_path_type("example.com"), PathType::File);
    }

    #[test]
    fn classification_follows_the_extensions_precedence() {
        assert_eq!(classify_path_type("https://a/b"), PathType::Url);
        assert_eq!(classify_path_type("file:///a"), PathType::Url);
        assert_eq!(classify_path_type("//host/share"), PathType::Url);
        assert_eq!(classify_path_type("///triple"), PathType::Absolute);
        assert_eq!(classify_path_type("#anchor"), PathType::Unknown);
        assert_eq!(classify_path_type("/abs"), PathType::Absolute);
        assert_eq!(classify_path_type(r"C:\x"), PathType::Absolute);
        assert_eq!(classify_path_type("C:/x"), PathType::Absolute);
        assert_eq!(classify_path_type("./rel"), PathType::Relative);
        assert_eq!(classify_path_type("../rel"), PathType::Relative);
        assert_eq!(classify_path_type("name.ext"), PathType::File);
        assert_eq!(classify_path_type("plain"), PathType::Unknown);
    }

    /// Classification is independent of `is_path_like`: it answers for
    /// whatever it is handed, including values the heuristic rejects.
    #[test]
    fn classification_answers_for_rejected_values_too() {
        assert_eq!(classify_path_type("1.8.1"), PathType::File);
        assert_eq!(classify_path_type(""), PathType::Unknown);
    }
}
