//! Path-like cells from CSV.
//!
//! Positions are cell coordinates — line is the row number, column is
//! the cell index, **not** a character offset. That is the extension's
//! contract and the context string repeats both so nobody reads a
//! column here as an offset into the line.

use super::js;
use super::position::Position;
use super::{Extracted, Path, heuristics};

/// The character between cells, and the name the context line goes by.
///
/// Tab-separated files are the same grammar with a different delimiter,
/// and reading one on commas made every row a single cell — which is
/// never path-like, so the file reported no paths, no diagnostic and
/// exit 1. Held equal to the extension's `DELIMITERS` by the corpus.
pub(crate) const COMMA: char = ',';
pub(crate) const TAB: char = '\t';

const QUOTE: char = '"';

/// The row separators the reader discovers, in its order of preference.
/// Windows before the classic Mac ending, or every `\r\n` would read as
/// a `\r` row followed by an empty one.
const ENDINGS: [&str; 3] = ["\r\n", "\n", "\r"];

pub(crate) fn extract(content: &str, delimiter: char) -> Extracted {
    let label = if delimiter == TAB { "TSV" } else { "CSV" };
    if js::is_blank(content) {
        return Ok(Vec::new());
    }

    // `csv-parse` was asked to strip a byte-order mark; both readers do
    // it themselves now, or a leading BOM becomes part of the first
    // header cell.
    let content = content.strip_prefix('\u{feff}').unwrap_or(content);

    // A refused document says why. It used to report nothing at all,
    // matching the extension's `catch { return [] }` — and a document
    // holding `/etc/passwd` then came back as no paths and no
    // diagnostics, which is indistinguishable from a file that is
    // genuinely clean. That silent miss is the failure this family
    // exists to prevent, so both readers now name the malformation.
    // Still no partial answer: a half-read CSV would report positions
    // that do not correspond to the file.
    let records = rows(content, delimiter).map_err(|refusal| refusal.message(label))?;

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
    Ok(paths)
}

/// Why the reader gave up, and where.
///
/// The coordinates are the ones a reported path carries — the row number
/// and the cell index, both counted from one — so "row 2, cell 3" names
/// the same place in the document as `CSV cell [2,3]` does. A byte
/// offset would not: the two frontends count a document's length in
/// different units, and this message has to come out byte-identical from
/// both.
#[derive(Debug, PartialEq, Eq)]
struct Refusal {
    reason: Reason,
    row: usize,
    cell: usize,
}

/// The two ways a document is malformed. Kept apart because the message
/// is the only place a reader learns which one happened, and "invalid
/// CSV" on its own tells them nothing they can act on.
#[derive(Debug, PartialEq, Eq)]
enum Reason {
    Unterminated,
    AfterClosingQuote,
}

impl Refusal {
    /// `label` is the name the context line goes by, so a tab-separated
    /// document is not reported as an invalid CSV.
    fn message(&self, label: &str) -> String {
        let what = match self.reason {
            Reason::Unterminated => "quoted field is never closed",
            Reason::AfterClosingQuote => "a closing quote is followed by more than whitespace",
        };
        format!(
            "Invalid {label}: {what} (row {}, cell {})",
            self.row, self.cell
        )
    }
}

/// Where the reader stands: the rows it has finished and the cells it
/// has taken, both counted from one.
fn at(reason: Reason, records: &[Vec<String>], record: &[String]) -> Refusal {
    Refusal {
        reason,
        row: records.len() + 1,
        cell: record.len() + 1,
    }
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
    /// how far the scan moves — `csv-parse` folds the two together. An
    /// `Err` refuses the document.
    ///
    /// A cell that has been through a closing quote keeps nothing more,
    /// whether or not a later quote re-opened it: whitespace may stand
    /// between the closing quote and the end of the cell, and nothing
    /// else may.
    fn push(&mut self, c: char) -> Result<usize, Reason> {
        let space = js::is_js_whitespace(c);
        let keeps = self.quoting || !self.text.is_empty() || !space;
        if keeps && !self.was_quoted {
            self.text.push(c);
            return Ok(c.len_utf8());
        }
        if !space {
            return Err(Reason::AfterClosingQuote);
        }
        // Whitespace the reader drops: leading whitespace, or the run
        // after a closing quote. `csv-parse` steps a whole character
        // over the first and a single *byte* over the second, so a
        // multi-byte space there landed mid-sequence next time round,
        // where no separator, quote or space can match, and refused a
        // document nobody had mis-quoted. U+00A0 and U+FEFF are ordinary
        // things to find in a spreadsheet export, so the whole character
        // is stepped over on both frontends now: whitespace is
        // whitespace whatever its encoded length.
        Ok(c.len_utf8())
    }
}

/// The reader the extension spells out in
/// `src/extraction/formats/csv.ts`, rule for rule — `csv-parse` under
/// `trim`, `relax_quotes`, `skip_empty_lines` and `relax_column_count`,
/// with the one rule below that is deliberately not mirrored.
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
/// The extension carries the same reader for the same kind of reason:
/// `csv-parse` *throws* on the malformations below, so nothing on that
/// side could name which one happened, and it walks the whitespace after
/// a closing quote one byte at a time, so nothing could stop it refusing
/// a document over a no-break space. Two readers, one rule set, held
/// equal by `fixtures/mcp-extract-paths.json`.
///
/// An `Err` is the refusal both frontends report, and exactly two things
/// produce it: a quote left open at the end of the document, and
/// anything but whitespace between a closing quote and the end of its
/// cell.
fn rows(content: &str, delimiter: char) -> Result<Vec<Vec<String>>, Refusal> {
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
            rest = quoted(&mut cell, &mut ending, rest, delimiter)
                .map_err(|reason| at(reason, &records, &record))?;
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

        let step = cell
            .push(c)
            .map_err(|reason| at(reason, &records, &record))?;
        rest = &rest[step..];
    }

    if cell.quoting {
        return Err(at(Reason::Unterminated, &records, &record));
    }
    if cell.was_quoted || !cell.text.is_empty() || !record.is_empty() {
        record.push(cell.take());
        records.push(record);
    }
    Ok(records)
}

/// One step inside `"…"`, returning what is left to read.
fn quoted<'a>(
    cell: &mut Cell,
    ending: &mut Option<&'a str>,
    rest: &'a str,
    delimiter: char,
) -> Result<&'a str, Reason> {
    // A doubled quote is one quote of text, and it can never be the
    // closing one. The reader steps over the first and takes the second
    // as an ordinary character, so it goes through `push` like one.
    if let Some(tail) = rest.strip_prefix("\"\"") {
        cell.push(QUOTE)?;
        return Ok(tail);
    }
    let Some(c) = rest.chars().next() else {
        return Err(Reason::Unterminated);
    };
    if c != QUOTE {
        return Ok(&rest[cell.push(c)?..]);
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
        return Err(Reason::AfterClosingQuote);
    }
    cell.quoting = false;
    cell.was_quoted = true;
    Ok(after)
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

    /// The paths of a document that reads. Every case below either goes
    /// through this or asserts the refusal by hand, so a test can never
    /// pass by quietly reading a refusal as an empty result.
    fn read(content: &str, delimiter: char) -> Vec<Path> {
        extract(content, delimiter).expect("the document reads")
    }

    /// The delimiter is the whole fix: read on commas, a tab row is one
    /// cell, which is never path-like, so a `.tsv` full of paths
    /// reported nothing and exited 1 like a clean file.
    #[test]
    fn a_tab_row_is_cells_under_tab_and_one_cell_under_comma() {
        let text = "name\tpath\nalpha\t./src/a.ts\n";
        let tabbed = read(text, TAB);
        assert_eq!(tabbed.len(), 1);
        assert_eq!(tabbed[0].value, "./src/a.ts");
        assert_eq!(tabbed[0].context, "TSV cell [2,2]");
        assert!(read(text, COMMA).is_empty());
    }

    #[test]
    fn a_blank_document_yields_nothing() {
        assert!(read("", COMMA).is_empty());
        assert!(read(" \n ", COMMA).is_empty());
    }

    #[test]
    fn positions_are_cell_coordinates() {
        let paths = read("a,b\nx,/srv/f.txt\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position, Position { line: 2, column: 2 });
        assert_eq!(paths[0].context, "CSV cell [2,2]");
    }

    #[test]
    fn a_quoted_cell_may_contain_a_space() {
        let paths = read("a\n\"./with space/f.png\"\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "./with space/f.png");
        assert_eq!(paths[0].kind, PathType::Relative);
    }

    #[test]
    fn cells_are_trimmed_before_the_heuristic_sees_them() {
        let paths = read("a\n   /srv/f.txt   \n", COMMA);
        assert_eq!(paths[0].value, "/srv/f.txt");
    }

    #[test]
    fn ragged_rows_are_data_not_an_error() {
        let paths = read(
            "a,b,c\n/one.txt\n/two.txt,/three.txt,/four.txt,/five.txt\n",
            COMMA,
        );
        assert_eq!(paths.len(), 5);
    }

    #[test]
    fn version_strings_and_plain_words_are_not_paths() {
        let paths = read("version,name\n3.4.5,not-a-path\n", COMMA);
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
        let paths = read("a\n\u{85}/a.txt\n", COMMA);
        assert_eq!(paths[0].value, "\u{85}/a.txt");
        assert_eq!(paths[0].kind, PathType::File);

        // U+FEFF is the mirror image — whitespace to JavaScript and not
        // to Rust — so it goes.
        let paths = read("a\nx,\u{feff}/a.txt\n", COMMA);
        assert_eq!(paths[0].value, "/a.txt");
        assert_eq!(paths[0].kind, PathType::Absolute);
    }

    #[test]
    fn a_byte_order_mark_does_not_corrupt_the_first_cell() {
        let paths = read("\u{feff}/srv/f.txt\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "/srv/f.txt");
    }

    #[test]
    fn empty_lines_do_not_shift_the_rows_after_them() {
        let paths = read("a\n\n/srv/f.txt\n", COMMA);
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
        let refusal = extract("\"./no-extension\",two\n1,2\n", TAB).expect_err("a refusal");
        assert_eq!(
            refusal,
            "Invalid TSV: a closing quote is followed by more than whitespace (row 1, cell 1)"
        );
        assert!(rows("\"./no-extension\",two\n1,2\n", TAB).is_err());

        // The same bytes on commas are well-formed and still read.
        let paths = read("\"./no-extension\",two\n1,2\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "./no-extension");
        assert_eq!(paths[0].position, Position { line: 1, column: 1 });
    }

    /// A refusal is the whole document, not the offending cell: the
    /// reader cannot place a path from a file it stopped reading, so a
    /// good path on a later row goes unreported too. What it may never do
    /// is go unreported *silently* — this document holds `/real/path.txt`
    /// and used to come back as no paths with an empty `diagnostics`,
    /// which reads as a file that is clean.
    #[test]
    fn a_refusal_abandons_every_row_and_says_so() {
        for delimiter in [COMMA, TAB] {
            let separator = if delimiter == TAB { '\t' } else { ',' };
            let document = format!("\"a\"x{separator}/real/path.txt\n");
            let refusal = extract(&document, delimiter).expect_err("a refusal");
            assert!(refusal.contains("closing quote"), "{refusal}");
            assert!(!refusal.is_empty());
        }
    }

    /// Both spellings of malformed quoting, on both delimiters, each with
    /// the message that names which one happened. "Invalid CSV" on its
    /// own would leave a reader nothing to act on.
    #[test]
    fn every_malformed_quote_refuses_with_the_reason_that_applies() {
        for delimiter in [COMMA, TAB] {
            let label = if delimiter == TAB { "TSV" } else { "CSV" };
            let closing = format!(
                "Invalid {label}: a closing quote is followed by more than whitespace (row 1, cell 1)"
            );
            let never = format!("Invalid {label}: quoted field is never closed (row 1, cell 1)");

            // Junk straight after the closing quote.
            assert_eq!(refusal("\"abc\"def\n", delimiter), closing);
            // Junk after the closing quote and its trailing space.
            assert_eq!(refusal("  \"a\"  x,b\n", delimiter), closing);
            // A closing quote followed by junk at the end of the file.
            assert_eq!(refusal("\"abc\"x", delimiter), closing);
            // Never closed at all.
            assert_eq!(refusal("\"unterminated\n", delimiter), never);
            assert_eq!(refusal("\"", delimiter), never);
            // The doubled quote swallowed the closing one.
            assert_eq!(refusal("\"a\"\"\n", delimiter), never);
        }
    }

    /// The refusal points at the cell it gave up on, in the coordinates a
    /// reported path carries — so `row 3, cell 2` is the cell a result
    /// would have called `CSV cell [3,2]`.
    #[test]
    fn a_refusal_names_the_cell_it_gave_up_on() {
        assert_eq!(
            refusal("a,b\nc,d\ne,\"f\"x\n", COMMA),
            "Invalid CSV: a closing quote is followed by more than whitespace (row 3, cell 2)"
        );
        assert_eq!(
            refusal("a,b\nc,\"never closed\n", COMMA),
            "Invalid CSV: quoted field is never closed (row 2, cell 2)"
        );
    }

    /// A quote that is not at the start of a cell is text, which is what
    /// `relax_quotes` is actually for. None of these refuse.
    #[test]
    fn a_quote_inside_a_cell_is_literal_text() {
        assert_eq!(rows("a\"b,c\n", COMMA), Ok(vec![vec_of(&["a\"b", "c"])]));
        assert_eq!(
            rows("abc\"def\"\n", COMMA),
            Ok(vec![vec_of(&["abc\"def\""])])
        );
        assert_eq!(
            rows("ab\"\ncd\n", COMMA),
            Ok(vec![vec_of(&["ab\""]), vec_of(&["cd"]),])
        );
        // Under tabs the same row is one cell, quotes and commas and all.
        assert_eq!(rows("a\"b,c\n", TAB), Ok(vec![vec_of(&["a\"b,c"])]));
    }

    /// Well-formed quoting still means what it always did, on either
    /// delimiter: the delimiter inside the quotes is text.
    #[test]
    fn a_delimiter_inside_a_well_formed_quoted_cell_does_not_split_it() {
        assert_eq!(rows("\"a,b\",c\n", COMMA), Ok(vec![vec_of(&["a,b", "c"])]));
        assert_eq!(rows("\"a\tb\"\tc\n", TAB), Ok(vec![vec_of(&["a\tb", "c"])]));
        // A doubled quote is one quote of text, and a quoted cell may
        // carry a row separator.
        assert_eq!(rows("\"a\"\"b\"\n", COMMA), Ok(vec![vec_of(&["a\"b"])]));
        assert_eq!(rows("\"\"\"\"\n", COMMA), Ok(vec![vec_of(&["\""])]));
        assert_eq!(
            rows("\"a\nb\",c\n", COMMA),
            Ok(vec![vec_of(&["a\nb", "c"])])
        );
    }

    /// Whitespace may stand between a closing quote and the end of its
    /// cell, and how many bytes it is spelled with is none of the
    /// reader's business.
    ///
    /// `csv-parse` walks that run a byte at a time, so U+00A0 refused
    /// where U+0020 was skipped — and a no-break space is an ordinary
    /// thing to find in a spreadsheet export. Both frontends step the
    /// whole character now; this is the one rule deliberately *not*
    /// mirrored from `csv-parse`.
    #[test]
    fn whitespace_after_a_closing_quote_is_whitespace_whatever_its_length() {
        assert_eq!(rows("\"a\" ,b\n", COMMA), Ok(vec![vec_of(&["a", "b"])]));
        assert_eq!(rows("  \"a\"  ,b\n", COMMA), Ok(vec![vec_of(&["a", "b"])]));
        for space in ['\u{a0}', '\u{feff}', '\u{2028}', '\u{2003}', '\u{3000}'] {
            assert_eq!(
                rows(&format!("\"a\"{space},b\n"), COMMA),
                Ok(vec![vec_of(&["a", "b"])]),
                "{space:?} after a closing quote"
            );
            assert_eq!(
                rows(&format!("\"a\" {space} ,b\n"), COMMA),
                Ok(vec![vec_of(&["a", "b"])]),
                "{space:?} in a run after a closing quote"
            );
        }
        // The whole document, not just the reader: a spreadsheet export
        // whose header carries one used to report none of its paths.
        let paths = read(
            "\"name\"\u{a0},size\n/etc/passwd,1\n/var/log/app.log,2\n",
            COMMA,
        );
        assert_eq!(paths.len(), 2);
        assert_eq!(paths[0].value, "/etc/passwd");
        assert_eq!(paths[1].value, "/var/log/app.log");

        // An empty quoted cell has nothing to keep, and always stepped
        // the whole character.
        assert_eq!(rows("\"\"\u{a0},b\n", COMMA), Ok(vec![vec_of(&["", "b"])]));
        assert_eq!(
            rows("\"\" \u{feff},b\n", COMMA),
            Ok(vec![vec_of(&["", "b"])])
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
        assert_eq!(rows("\"\" \"\" ", COMMA), Ok(vec![vec_of(&[""])]));
        assert_eq!(rows("\"\" \"\",b\n", COMMA), Ok(vec![vec_of(&["", "b"])]));
        // Something to keep, so it refuses.
        assert!(rows("\"\" \"./b.ts\"\n", COMMA).is_err());
        assert!(rows("\"\"\t\"\"\"\"\r./b.ts", COMMA).is_err());
        assert!(rows("\"\" \u{feff}\"./b.ts\"\r/c.md", TAB).is_err());
    }

    /// The row separator is fixed by the first one outside a quoted
    /// cell, so a document that mixes them keeps the first and reads the
    /// others as text.
    #[test]
    fn the_row_separator_is_whichever_one_came_first() {
        assert_eq!(
            rows("a,b\nc\r\nd\n", COMMA),
            Ok(vec![vec_of(&["a", "b"]), vec_of(&["c"]), vec_of(&["d"])])
        );
        assert_eq!(
            rows("a,b\r\nc\nd\r\n", COMMA),
            Ok(vec![vec_of(&["a", "b"]), vec_of(&["c\nd"])])
        );
        assert_eq!(
            rows("a,b\rc,d\r", COMMA),
            Ok(vec![vec_of(&["a", "b"]), vec_of(&["c", "d"])])
        );
    }

    /// A row of nothing but whitespace produced no cell, so it is
    /// dropped like an empty one — and the rows after it keep their
    /// numbers. U+0085 is not whitespace to JavaScript, so a row holding
    /// one is a row.
    #[test]
    fn a_whitespace_only_row_does_not_shift_the_rows_after_it() {
        let paths = read("a\n   \n/srv/f.txt\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 2);

        let paths = read("a\n\u{85}\n/srv/f.txt\n", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 3);
    }

    /// A cell that ends the document without a row separator is still a
    /// cell, quoted or not.
    #[test]
    fn a_document_that_stops_without_a_row_separator_keeps_its_last_cell() {
        let paths = read("one,two\n\"./x.ts\",2", COMMA);
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position, Position { line: 2, column: 1 });
        assert_eq!(rows("a,", COMMA), Ok(vec![vec_of(&["a", ""])]));
        assert_eq!(rows("\"abc\" ", COMMA), Ok(vec![vec_of(&["abc"])]));
    }

    fn refusal(content: &str, delimiter: char) -> String {
        extract(content, delimiter).expect_err("a refusal")
    }

    fn vec_of(cells: &[&str]) -> Vec<String> {
        cells.iter().map(|c| (*c).to_string()).collect()
    }
}
