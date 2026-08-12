//! The generic scan, for a document no typed extractor reads.
//!
//! Every other extractor here hands `heuristics::is_path_like` an
//! already-delimited token — a JSON string, an env value, a CSV cell —
//! which is the assumption the heuristic is written against. Raw text
//! has no such token, so this produces them: a quoted string is a
//! delimited token and gets the whole heuristic, and everything else is
//! a run between whitespace and the punctuation that wraps a path in
//! real code, which gets a narrower one.
//!
//! **A bare `name.ext` run is not claimed.** `os.path`, `np.array` and
//! `logger.info` are `name.ext` to the shared heuristic and there is
//! nothing structural to tell them from `main.py`: an extension and an
//! attribute are the same shape, and separating them by dictionary is
//! the TLD list SPEC.md already declined for `example.com`. What does
//! separate them is the delimiter — source quotes its filenames and does
//! not quote its attribute access — so an undelimited run must carry a
//! separator, while `open("data.csv")` still reports `data.csv` because
//! the quotes made it a token. `fixtures/documents/paths.py` pins both
//! halves.

use super::position::PositionIndex;
use super::{Path, heuristics, js};

/// What the report says a generic scan found. Every typed extractor
/// names the construct it read (`JS import`, `TOML key`); this one has
/// no construct to name, so it names the mechanism instead.
const CONTEXT: &str = "Text scan";

/// Ends an undelimited run: the punctuation that wraps a path in real
/// text — a call's parentheses, an array's brackets, a list's commas, an
/// assignment's `=`.
///
/// `<>|*?` are deliberately absent even though they are also delimiters
/// in places. They are forbidden inside a candidate anyway, so leaving
/// them inside the run rejects the whole token rather than salvaging a
/// fragment of it: `src/**/*.ts` stays one rejected glob instead of
/// becoming `src/` and `.ts`.
const BREAKS: [char; 9] = ['(', ')', '[', ']', '{', '}', ',', ';', '='];

const QUOTES: [char; 3] = ['\'', '"', '`'];

/// Structure, as opposed to content. A candidate made of nothing else is
/// not a path: `//` opens a comment in half the languages in a
/// repository and matches the Unix-absolute pattern exactly, and `///`
/// and `./..` are the same problem.
///
/// Spelled as "not only these" rather than "contains a letter or digit"
/// because the two frontends have to agree character for character, and
/// Rust's `char::is_alphanumeric` and a JavaScript property escape are
/// two Unicode tables that can drift. This rule needs no table, and it
/// keeps `/文档/報告`, which an ASCII test would have thrown away.
const STRUCTURE: [char; 3] = ['/', '\\', '.'];

pub(crate) fn extract(content: &str) -> Vec<Path> {
    let index = PositionIndex::new(content);
    let mut paths = Vec::new();
    scan(content, |offset, token, delimited| {
        claim(offset, token, delimited, &index, &mut paths);
    });
    paths
}

/// Split the document into candidate tokens, in document order.
///
/// A quoted run is emitted with `delimited` set and the scan resumes
/// past its closing quote, so its contents are never also read as bare
/// text — which is what keeps one path from being reported twice.
fn scan(content: &str, mut emit: impl FnMut(usize, &str, bool)) {
    let mut offset = 0;
    while let Some(current) = content[offset..].chars().next() {
        let width = current.len_utf8();

        if QUOTES.contains(&current) {
            offset = quoted(content, offset + width, current, &mut emit);
            continue;
        }

        if js::is_js_whitespace(current) || BREAKS.contains(&current) {
            offset += width;
            continue;
        }

        let end = content[offset..]
            .find(is_break)
            .map_or(content.len(), |at| offset + at);
        emit(offset, &content[offset..end], false);
        offset = end;
    }
}

/// Read the body of a quoted run, returning where the scan resumes.
///
/// **An unterminated quote is not a delimiter.** An apostrophe in a
/// comment — `# don't` — would otherwise swallow everything up to the
/// next one, taking the real paths in between with it, so the run has to
/// close on the same line to count.
fn quoted(
    content: &str,
    start: usize,
    quote: char,
    emit: &mut impl FnMut(usize, &str, bool),
) -> usize {
    let Some(close) = content[start..]
        .find([quote, '\n'])
        .map(|at| start + at)
        .filter(|at| content[*at..].starts_with(quote))
    else {
        return start;
    };
    emit(start, &content[start..close], true);
    close + quote.len_utf8()
}

fn is_break(character: char) -> bool {
    js::is_js_whitespace(character) || BREAKS.contains(&character) || QUOTES.contains(&character)
}

fn claim(
    offset: usize,
    token: &str,
    delimited: bool,
    index: &PositionIndex,
    paths: &mut Vec<Path>,
) {
    let body = js::trim_start(token);
    let leading = token.len() - body.len();
    // A delimited token is taken as written, minus the whitespace the
    // quote happened to include; an undelimited one loses the sentence
    // punctuation that ends it, so `see ./docs/a.md.` reports the file
    // and not the full stop.
    let value = if delimited {
        js::trim(body)
    } else {
        body.trim_end_matches(['.', ':'])
    };

    if value
        .chars()
        .all(|character| STRUCTURE.contains(&character))
    {
        return;
    }
    if !delimited && !value.contains(['/', '\\']) {
        return;
    }
    if !heuristics::is_path_like(value) {
        return;
    }
    paths.push(Path {
        value: value.to_string(),
        kind: heuristics::classify_path_type(value),
        position: index.at(offset + leading),
        context: CONTEXT.to_string(),
    });
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
    fn an_empty_document_yields_nothing() {
        assert!(extract("").is_empty());
        assert!(extract("   \n\t ").is_empty());
    }

    #[test]
    fn the_strong_shapes_are_claimed_undelimited() {
        assert_eq!(
            values("see /var/log/app.log and ./src/a.ts and ../up/b.ts"),
            ["/var/log/app.log", "./src/a.ts", "../up/b.ts"]
        );
    }

    #[test]
    fn a_windows_drive_letter_is_claimed() {
        assert_eq!(values(r"copy C:\Temp\cache there"), [r"C:\Temp\cache"]);
    }

    /// The rule this module exists for. Nothing structural separates the
    /// two, so the delimiter does.
    #[test]
    fn an_attribute_access_is_not_a_file_but_a_quoted_name_is() {
        assert!(values("import os.path\nos.path.join(BASE)").is_empty());
        assert_eq!(values("open(\"data.csv\")"), ["data.csv"]);
    }

    #[test]
    fn a_bare_name_with_an_extension_is_never_claimed_undelimited() {
        assert!(values("README.md is the file").is_empty());
        assert_eq!(values("`README.md` is the file"), ["README.md"]);
    }

    /// A separator is what an undelimited run needs, and every strong
    /// shape already carries one — so the rule costs nothing but the
    /// bare `name.ext`.
    #[test]
    fn an_undelimited_run_with_a_separator_is_claimed() {
        assert_eq!(
            values("# see docs/architecture.md"),
            ["docs/architecture.md"]
        );
    }

    /// The regression that made this guard necessary: `//` is two
    /// characters, matches the Unix-absolute pattern, and starts a
    /// comment on most lines of most repositories.
    #[test]
    fn a_comment_marker_is_not_an_absolute_path() {
        assert_eq!(values("// a note about ./x.ts"), ["./x.ts"]);
        assert!(values("///").is_empty());
        assert!(values("/* block */").is_empty());
    }

    #[test]
    fn punctuation_around_a_path_is_not_part_of_it() {
        assert_eq!(values("[docs](./guide.md)"), ["./guide.md"]);
        assert_eq!(values("load(['./a.ts', './b.ts'])"), ["./a.ts", "./b.ts"]);
        assert_eq!(values("PATH=/usr/local/bin"), ["/usr/local/bin"]);
    }

    #[test]
    fn a_trailing_sentence_mark_is_dropped() {
        assert_eq!(values("Read ./docs/a.md."), ["./docs/a.md"]);
        assert_eq!(values("at ./src/a.ts:"), ["./src/a.ts"]);
    }

    /// A delimited token may contain spaces, because that is what the
    /// shared heuristic promises a delimited token — the same rule a
    /// JSON string or a CSV cell gets.
    #[test]
    fn a_quoted_token_may_contain_spaces() {
        assert_eq!(
            values("f(\"/Users/me/My Files/a.txt\")"),
            ["/Users/me/My Files/a.txt"]
        );
        assert!(
            values("/Users/me/My Files/a.txt").len() > 1,
            "unquoted, it is two runs"
        );
    }

    /// An apostrophe in prose must not swallow the line, or the paths
    /// after it disappear.
    #[test]
    fn an_unterminated_quote_is_not_a_delimiter() {
        assert_eq!(values("# don't forget ./setup.sh"), ["./setup.sh"]);
    }

    #[test]
    fn a_quoted_run_is_not_also_read_as_bare_text() {
        assert_eq!(values("x = \"./once.ts\""), ["./once.ts"]);
    }

    #[test]
    fn positions_are_where_the_path_starts() {
        let paths = extract("first line\nrun ./tool.sh now\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 2);
        assert_eq!(paths[0].position.column, 5);
    }

    /// The quote is not part of the path, so the position skips it —
    /// the same rule the JSON extractor follows.
    #[test]
    fn a_quoted_paths_position_skips_the_quote() {
        let paths = extract("x(\"./a.ts\")");
        assert_eq!(paths[0].position.column, 4);
    }

    /// Columns count UTF-16 code units everywhere in this crate, and a
    /// scanner that counted bytes would answer 8 here.
    #[test]
    fn columns_count_utf16_code_units() {
        let paths = extract("# 🎯 ./a.ts");
        assert_eq!(paths[0].position.column, 6);
    }

    #[test]
    fn every_claim_carries_the_scan_context_and_a_kind() {
        let paths = extract("/abs/a.ts ./rel.ts https://example.com/x");
        assert_eq!(paths.len(), 3);
        assert!(paths.iter().all(|path| path.context == CONTEXT));
        assert_eq!(paths[0].kind, PathType::Absolute);
        assert_eq!(paths[1].kind, PathType::Relative);
        assert_eq!(paths[2].kind, PathType::Url);
    }

    /// Forbidden characters reject the whole run rather than being split
    /// around, which is what keeps a glob out of the results instead of
    /// turning it into two fragments.
    #[test]
    fn a_glob_is_rejected_whole() {
        assert!(values("src/**/*.ts").is_empty());
    }

    #[test]
    fn a_version_string_is_still_not_a_path() {
        assert!(values("version 1.8.1 and 192.168.1.1").is_empty());
    }

    /// The scanner walks by character, not by byte, so a multi-byte
    /// character mid-document cannot desynchronise it.
    #[test]
    fn multibyte_text_does_not_shift_the_scan() {
        assert_eq!(values("café ./a.ts café"), ["./a.ts"]);
    }

    /// The structure guard must not be an ASCII test: a path written in
    /// another script is an ordinary path.
    #[test]
    fn a_path_in_another_script_survives_the_structure_guard() {
        assert_eq!(values("開く /文書/報告"), ["/文書/報告"]);
    }

    /// Token boundaries follow JavaScript's whitespace set, not
    /// Unicode's, because the extension's do — U+FEFF splits a run here
    /// and U+0085 does not, and getting either backwards is two
    /// frontends reading the same file differently.
    #[test]
    fn token_boundaries_use_javascripts_whitespace_set() {
        assert_eq!(values("x /a/b\u{feff}c"), ["/a/b"]);
        assert_eq!(values("x /a/b\u{85}c"), ["/a/b\u{85}c"]);
    }
}
