//! Path-like cells from CSV.
//!
//! Positions are cell coordinates — line is the row number, column is
//! the cell index, **not** a character offset. That is the extension's
//! contract and the context string repeats both so nobody reads a
//! column here as an offset into the line.

use super::js;
use super::position::Position;
use super::{Path, heuristics};

/// The character between cells, and the name the context line goes by.
///
/// Tab-separated files are the same grammar with a different delimiter,
/// and reading one on commas made every row a single cell — which is
/// never path-like, so the file reported no paths, no diagnostic and
/// exit 1. Held equal to the extension's `DELIMITERS` by the corpus.
pub(crate) const COMMA: char = ',';
pub(crate) const TAB: char = '\t';

const QUOTE: char = '"';

/// The row separators `csv-parse` discovers, in its order of preference.
/// Windows before the classic Mac ending, or every `\r\n` would read as
/// a `\r` row followed by an empty one.
const ENDINGS: [&str; 3] = ["\r\n", "\n", "\r"];

pub(crate) fn extract(content: &str, delimiter: char) -> Vec<Path> {
    let label = if delimiter == TAB { "TSV" } else { "CSV" };
    if js::is_blank(content) {
        return Vec::new();
    }

    // The extension's reader strips a byte-order mark; this one does
    // not, and a leading BOM would otherwise become part of the first
    // header cell.
    let content = content.strip_prefix('\u{feff}').unwrap_or(content);

    // A refused document reports nothing at all, matching the
    // extension's `catch { return [] }`. A half-read CSV would report
    // positions that do not correspond to the file.
    let Some(records) = rows(content, delimiter) else {
        return Vec::new();
    };

    let mut paths = Vec::new();
    for (row_index, record) in records.iter().enumerate() {
        for (column_index, cell) in record.iter().enumerate() {
            // The extension trims every cell with `String.prototype.trim`
            // on top of whatever the reader did, and the two languages'
            // notions of whitespace differ over U+0085 and U+FEFF —
            // which is the whole reason `js` exists. This is that trim.
            let cell = js::trim(cell);
            if !heuristics::is_path_like(cell) {
                continue;
            }
            let line = row_index + 1;
            let column = column_index + 1;
            paths.push(Path {
                value: cell.to_string(),
                kind: heuristics::classify_path_type(cell),
                position: Position { line, column },
                context: format!("{label} cell [{line},{column}]"),
            });
        }
    }
    paths
}

/// The cell being read.
struct Cell {
    text: String,
    /// Set by the closing quote and cleared only when the cell ends. It
    /// is what keeps the cell's own whitespace, and what turns
    /// everything after the closing quote into either whitespace or a
    /// refusal.
    was_quoted: bool,
    /// Whether the scan is between the quotes.
    quoting: bool,
}

impl Cell {
    /// The finished text. A quoted cell keeps the whitespace inside its
    /// quotes; an unquoted one is right-trimmed, its left side having
    /// been dropped as it was read.
    fn take(&mut self) -> String {
        let mut text = std::mem::take(&mut self.text);
        if !self.was_quoted {
            text.truncate(js::trim_end(&text).len());
        }
        self.was_quoted = false;
        text
    }

    /// One character of text, which decides both what the cell keeps and
    /// how far the scan moves — `csv-parse` folds the two together.
    /// `None` refuses the document.
    ///
    /// A cell that has been through a closing quote keeps nothing more,
    /// whether or not a later quote re-opened it: whitespace may stand
    /// between the closing quote and the end of the cell, and nothing
    /// else may.
    fn push(&mut self, c: char) -> Option<usize> {
        let space = js::is_js_whitespace(c);
        let keeps = self.quoting || !self.text.is_empty() || !space;
        if keeps && !self.was_quoted {
            self.text.push(c);
            return Some(c.len_utf8());
        }
        if !space {
            return None;
        }
        // Whitespace the reader drops: leading whitespace, or the run
        // after a closing quote. It steps a whole character over the
        // first and a single *byte* over the second, so a multi-byte
        // space there lands mid-sequence next time round, where no
        // separator, quote or space can match and the document is
        // refused. U+00A0 and U+FEFF are ordinary things to find in a
        // spreadsheet export, so the quirk is reproduced rather than
        // tidied away.
        if !keeps {
            return Some(c.len_utf8());
        }
        (c.len_utf8() == 1).then_some(1)
    }
}

/// The extension's reader, rule for rule — `csv-parse` under `trim`,
/// `relax_quotes`, `skip_empty_lines` and `relax_column_count`.
///
/// Hand-written because no Rust reader answers the same way. Asked to
/// read `"./a",b` with a tab delimiter — one cell whose text is
/// `"./a",b` — the `csv` crate recovers, joins the quoted section to the
/// remainder as `./a,b`, and reports a path nobody wrote. Turning its
/// quoting off instead breaks the well-formed case, where `"a,b",c` must
/// stay two cells. There is no third setting, and inventing a path out
/// of a cell somebody quoted wrong is the failure this family exists to
/// refuse.
///
/// `None` is the parse error the extension catches, and exactly two
/// things produce it: a quote left open at the end of the document, and
/// anything but whitespace between a closing quote and the end of its
/// cell.
fn rows(content: &str, delimiter: char) -> Option<Vec<Vec<String>>> {
    let mut records: Vec<Vec<String>> = Vec::new();
    let mut record: Vec<String> = Vec::new();
    let mut cell = Cell {
        text: String::new(),
        was_quoted: false,
        quoting: false,
    };
    let mut ending: Option<&str> = None;
    let mut rest = content;

    while let Some(c) = rest.chars().next() {
        if cell.quoting {
            rest = quoted(&mut cell, &mut ending, rest, delimiter)?;
            continue;
        }

        // The row separator is whatever ends the first row outside a
        // quoted cell, and it is fixed from there: in a `\n` document a
        // stray `\r` is text.
        if ending.is_none() {
            ending = line_ending(rest);
        }

        if let Some(tail) = ending.and_then(|e| rest.strip_prefix(e)) {
            rest = tail;
            // A row that produced no cell at all is dropped, so a blank
            // line does not shift the rows after it.
            if !cell.was_quoted && cell.text.is_empty() && record.is_empty() {
                continue;
            }
            record.push(cell.take());
            records.push(std::mem::take(&mut record));
            continue;
        }

        if let Some(tail) = rest.strip_prefix(delimiter) {
            record.push(cell.take());
            rest = tail;
            continue;
        }

        // A quote opens a cell only where nothing precedes it. Anywhere
        // else it is literal text, and that is the whole of what
        // `relax_quotes` relaxes.
        if c == QUOTE && cell.text.is_empty() {
            cell.quoting = true;
            rest = &rest[QUOTE.len_utf8()..];
            continue;
        }

        rest = &rest[cell.push(c)?..];
    }

    if cell.quoting {
        return None;
    }
    if cell.was_quoted || !cell.text.is_empty() || !record.is_empty() {
        record.push(cell.take());
        records.push(record);
    }
    Some(records)
}

/// One step inside `"…"`, returning what is left to read.
fn quoted<'a>(
    cell: &mut Cell,
    ending: &mut Option<&'a str>,
    rest: &'a str,
    delimiter: char,
) -> Option<&'a str> {
    // A doubled quote is one quote of text, and it can never be the
    // closing one. The reader steps over the first and takes the second
    // as an ordinary character, so it goes through `push` like one.
    if let Some(tail) = rest.strip_prefix("\"\"") {
        cell.push(QUOTE)?;
        return Some(tail);
    }
    let c = rest.chars().next()?;
    if c != QUOTE {
        return Some(&rest[cell.push(c)?..]);
    }

    let after = &rest[QUOTE.len_utf8()..];
    if ending.is_none() {
        *ending = line_ending(after);
    }
    // `relax_quotes` nominally keeps the rest of a cell whose quoting is
    // malformed, but `trim` makes that path unreachable: the reader puts
    // the quote back, reads it again, and refuses it as a non-trimable
    // byte after a closing quote. Refusing here is the same answer one
    // step earlier — and it is the honest one. `"./a",b` read on tabs is
    // not the path `./a,b`; it is a cell somebody quoted wrong.
    if !closes(after, delimiter, *ending) {
        return None;
    }
    cell.quoting = false;
    cell.was_quoted = true;
    Some(after)
}

/// Whether a closing quote here really closes the cell.
fn closes(after: &str, delimiter: char, ending: Option<&str>) -> bool {
    after.is_empty()
        || after.starts_with(delimiter)
        || ending.is_some_and(|e| after.starts_with(e))
        || after.chars().next().is_some_and(js::is_js_whitespace)
}

fn line_ending(rest: &str) -> Option<&'static str> {
    ENDINGS.into_iter().find(|e| rest.starts_with(e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::PathType;

    /// The delimiter is the whole fix: read on commas, a tab row is one
    /// cell, which is never path-like, so a `.tsv` full of paths
    /// reported nothing and exited 1 like a clean file.
    #[test]
    fn a_tab_row_is_cells_under_tab_and_one_cell_under_comma() {
        let text = "name\tpath\nalpha\t./src/a.ts\n";
        let tabbed = extract(text, TAB);
        assert_eq!(tabbed.len(), 1);
        assert_eq!(tabbed[0].value, "./src/a.ts");
        assert_eq!(tabbed[0].context, "TSV cell [2,2]");
        assert!(extract(text, COMMA).is_empty());
    }

    #[test]
    fn a_blank_document_yields_nothing() {
        assert!(extract("", COMMA).is_empty());
        assert!(extract(" \n ", COMMA).is_empty());
    }

    #[test]
    fn positions_are_cell_coordinates() {
        let paths = extract("a,b\nx,/srv/f.txt\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position, Position { line: 2, column: 2 });
        assert_eq!(paths[0].context, "CSV cell [2,2]");
    }

    #[test]
    fn a_quoted_cell_may_contain_a_space() {
        let paths = extract("a\n\"./with space/f.png\"\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "./with space/f.png");
        assert_eq!(paths[0].kind, PathType::Relative);
    }

    #[test]
    fn cells_are_trimmed_before_the_heuristic_sees_them() {
        let paths = extract("a\n   /srv/f.txt   \n", COMMA);
        assert_eq!(paths[0].value, "/srv/f.txt");
    }

    #[test]
    fn ragged_rows_are_data_not_an_error() {
        let paths = extract(
            "a,b,c\n/one.txt\n/two.txt,/three.txt,/four.txt,/five.txt\n",
            COMMA,
        );
        assert_eq!(paths.len(), 5);
    }

    #[test]
    fn version_strings_and_plain_words_are_not_paths() {
        let paths = extract("version,name\n3.4.5,not-a-path\n", COMMA);
        assert!(paths.is_empty());
    }

    /// A regression the generated differential found: the reader was
    /// asked to trim, and its trim is Rust's — so a cell led by U+0085
    /// came back as `/a.txt` here and as `\u{85}/a.txt` from the npm
    /// server, which classified it `file` where this said `absolute`.
    /// The two spellings of whitespace are the whole reason `js` exists;
    /// trimming has to go through it.
    #[test]
    fn cells_are_trimmed_with_javascripts_whitespace_not_rusts() {
        // U+0085 is whitespace to Rust and not to JavaScript: it stays.
        let paths = extract("a\n\u{85}/a.txt\n", COMMA);
        assert_eq!(paths[0].value, "\u{85}/a.txt");
        assert_eq!(paths[0].kind, PathType::File);

        // U+FEFF is the mirror image — whitespace to JavaScript and not
        // to Rust — so it goes.
        let paths = extract("a\nx,\u{feff}/a.txt\n", COMMA);
        assert_eq!(paths[0].value, "/a.txt");
        assert_eq!(paths[0].kind, PathType::Absolute);
    }

    #[test]
    fn a_byte_order_mark_does_not_corrupt_the_first_cell() {
        let paths = extract("\u{feff}/srv/f.txt\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "/srv/f.txt");
    }

    #[test]
    fn empty_lines_do_not_shift_the_rows_after_them() {
        let paths = extract("a\n\n/srv/f.txt\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 2);
    }

    /// The differential's motivating case. A header cell quoted for
    /// commas, read on tabs, is one cell whose text is
    /// `"./no-extension",two` — quoting that closes in the middle of a
    /// cell. The `csv` crate recovered from it by gluing the quoted part
    /// to the rest and answering `./no-extension,two`, a path nobody
    /// wrote; `csv-parse` refuses the document, so this does too.
    #[test]
    fn a_quote_that_closes_mid_cell_refuses_the_document() {
        assert!(extract("\"./no-extension\",two\n1,2\n", TAB).is_empty());
        assert!(rows("\"./no-extension\",two\n1,2\n", TAB).is_none());

        // The same bytes on commas are well-formed and still read.
        let paths = extract("\"./no-extension\",two\n1,2\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "./no-extension");
        assert_eq!(paths[0].position, Position { line: 1, column: 1 });
    }

    /// A refusal is the whole document, not the offending cell: the
    /// extension's reader throws and its `catch` returns `[]`, so a
    /// perfectly good path on a later row goes unreported too. Reporting
    /// it here would be a different answer from the same input.
    #[test]
    fn a_refusal_abandons_every_row_including_the_good_ones() {
        assert!(extract("\"a\"x\n/real/path.txt\n", COMMA).is_empty());
        assert!(extract("\"a\"x\t/real/path.txt\n", TAB).is_empty());
    }

    /// Both spellings of malformed quoting, on both delimiters.
    #[test]
    fn every_malformed_quote_refuses_on_either_delimiter() {
        for delimiter in [COMMA, TAB] {
            // Junk straight after the closing quote.
            assert!(rows("\"abc\"def\n", delimiter).is_none());
            // Junk after the closing quote and its trailing space.
            assert!(rows("  \"a\"  x,b\n", delimiter).is_none());
            // A closing quote followed by junk at the end of the file.
            assert!(rows("\"abc\"x", delimiter).is_none());
            // Never closed at all.
            assert!(rows("\"unterminated\n", delimiter).is_none());
            assert!(rows("\"", delimiter).is_none());
            // The doubled quote swallowed the closing one.
            assert!(rows("\"a\"\"\n", delimiter).is_none());
        }
    }

    /// A quote that is not at the start of a cell is text, which is what
    /// `relax_quotes` is actually for. None of these refuse.
    #[test]
    fn a_quote_inside_a_cell_is_literal_text() {
        assert_eq!(rows("a\"b,c\n", COMMA), Some(vec![vec_of(&["a\"b", "c"])]));
        assert_eq!(
            rows("abc\"def\"\n", COMMA),
            Some(vec![vec_of(&["abc\"def\""])])
        );
        assert_eq!(
            rows("ab\"\ncd\n", COMMA),
            Some(vec![vec_of(&["ab\""]), vec_of(&["cd"]),])
        );
        // Under tabs the same row is one cell, quotes and commas and all.
        assert_eq!(rows("a\"b,c\n", TAB), Some(vec![vec_of(&["a\"b,c"])]));
    }

    /// Well-formed quoting still means what it always did, on either
    /// delimiter: the delimiter inside the quotes is text.
    #[test]
    fn a_delimiter_inside_a_well_formed_quoted_cell_does_not_split_it() {
        assert_eq!(
            rows("\"a,b\",c\n", COMMA),
            Some(vec![vec_of(&["a,b", "c"])])
        );
        assert_eq!(
            rows("\"a\tb\"\tc\n", TAB),
            Some(vec![vec_of(&["a\tb", "c"])])
        );
        // A doubled quote is one quote of text, and a quoted cell may
        // carry a row separator.
        assert_eq!(rows("\"a\"\"b\"\n", COMMA), Some(vec![vec_of(&["a\"b"])]));
        assert_eq!(rows("\"\"\"\"\n", COMMA), Some(vec![vec_of(&["\""])]));
        assert_eq!(
            rows("\"a\nb\",c\n", COMMA),
            Some(vec![vec_of(&["a\nb", "c"])])
        );
    }

    /// Whitespace is allowed to stand between a closing quote and the
    /// end of its cell — but `csv-parse` walks that run a byte at a
    /// time, so a multi-byte space refuses where a single-byte one is
    /// skipped, and only once the cell has text to keep.
    #[test]
    fn whitespace_after_a_closing_quote_follows_the_readers_own_rule() {
        assert_eq!(rows("\"a\" ,b\n", COMMA), Some(vec![vec_of(&["a", "b"])]));
        assert_eq!(
            rows("  \"a\"  ,b\n", COMMA),
            Some(vec![vec_of(&["a", "b"])])
        );
        assert!(rows("\"a\"\u{a0},b\n", COMMA).is_none());
        assert!(rows("\"a\" \u{a0},b\n", COMMA).is_none());
        assert!(rows("\"a\"\u{feff},b\n", COMMA).is_none());
        // An empty quoted cell has nothing to keep, so the reader steps
        // the whole character and reads on.
        assert_eq!(
            rows("\"\"\u{a0},b\n", COMMA),
            Some(vec![vec_of(&["", "b"])])
        );
        assert_eq!(
            rows("\"\" \u{feff},b\n", COMMA),
            Some(vec![vec_of(&["", "b"])])
        );
    }

    /// An empty quoted cell leaves nothing behind, so a second quote can
    /// open again — but the cell has still been through a closing quote,
    /// so the re-opened section may hold no text either. Both answers
    /// come from the same rule, and the randomised cross-check against
    /// `csv-parse` found the pair of them.
    #[test]
    fn a_cell_that_re_opens_its_quotes_may_still_keep_nothing() {
        // Nothing to keep, so it reads to the end.
        assert_eq!(rows("\"\" \"\" ", COMMA), Some(vec![vec_of(&[""])]));
        assert_eq!(rows("\"\" \"\",b\n", COMMA), Some(vec![vec_of(&["", "b"])]));
        // Something to keep, so it refuses.
        assert!(rows("\"\" \"./b.ts\"\n", COMMA).is_none());
        assert!(rows("\"\"\t\"\"\"\"\r./b.ts", COMMA).is_none());
        assert!(rows("\"\" \u{feff}\"./b.ts\"\r/c.md", TAB).is_none());
    }

    /// The row separator is fixed by the first one outside a quoted
    /// cell, so a document that mixes them keeps the first and reads the
    /// others as text.
    #[test]
    fn the_row_separator_is_whichever_one_came_first() {
        assert_eq!(
            rows("a,b\nc\r\nd\n", COMMA),
            Some(vec![vec_of(&["a", "b"]), vec_of(&["c"]), vec_of(&["d"])])
        );
        assert_eq!(
            rows("a,b\r\nc\nd\r\n", COMMA),
            Some(vec![vec_of(&["a", "b"]), vec_of(&["c\nd"])])
        );
        assert_eq!(
            rows("a,b\rc,d\r", COMMA),
            Some(vec![vec_of(&["a", "b"]), vec_of(&["c", "d"])])
        );
    }

    /// A row of nothing but whitespace produced no cell, so it is
    /// dropped like an empty one — and the rows after it keep their
    /// numbers. U+0085 is not whitespace to JavaScript, so a row holding
    /// one is a row.
    #[test]
    fn a_whitespace_only_row_does_not_shift_the_rows_after_it() {
        let paths = extract("a\n   \n/srv/f.txt\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 2);

        let paths = extract("a\n\u{85}\n/srv/f.txt\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 3);
    }

    /// A cell that ends the document without a row separator is still a
    /// cell, quoted or not.
    #[test]
    fn a_document_that_stops_without_a_row_separator_keeps_its_last_cell() {
        let paths = extract("one,two\n\"./x.ts\",2", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position, Position { line: 2, column: 1 });
        assert_eq!(rows("a,", COMMA), Some(vec![vec_of(&["a", ""])]));
        assert_eq!(rows("\"abc\" ", COMMA), Some(vec![vec_of(&["abc"])]));
    }

    fn vec_of(cells: &[&str]) -> Vec<String> {
        cells.iter().map(|c| (*c).to_string()).collect()
    }
}
