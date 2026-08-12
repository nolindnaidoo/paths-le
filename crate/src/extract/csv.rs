//! Path-like cells from CSV.
//!
//! Positions are cell coordinates — line is the row number, column is
//! the cell index, **not** a character offset. That is the extension's
//! contract and the context string repeats both so nobody reads a
//! column here as an offset into the line.

use super::js;
use super::position::Position;
use super::{Path, heuristics};

pub(crate) fn extract(content: &str) -> Vec<Path> {
    if js::is_blank(content) {
        return Vec::new();
    }

    // The extension's reader strips a byte-order mark; this one does
    // not, and a leading BOM would otherwise become part of the first
    // header cell.
    let content = content.strip_prefix('\u{feff}').unwrap_or(content);

    // Deliberately NOT `.trim(csv::Trim::All)`: that trims with Rust's
    // notion of whitespace, which includes U+0085 and excludes U+FEFF —
    // the exact two characters this crate spells out by hand in `js`
    // because JavaScript disagrees about both. The extension trims each
    // cell with `String.prototype.trim`, so `js::trim` below is the
    // whole trim, and a reader that got there first would quietly answer
    // differently on a cell those characters lead.
    let mut reader = ::csv::ReaderBuilder::new()
        .has_headers(false)
        // Rows of differing width are data, not an error: a path in a
        // ragged export is still a path.
        .flexible(true)
        .from_reader(content.as_bytes());

    let mut paths = Vec::new();
    for (row_index, record) in reader.records().enumerate() {
        // Any read error abandons the whole document, matching the
        // extension's `catch { return [] }`. A half-read CSV would
        // report positions that do not correspond to the file.
        let Ok(record) = record else {
            return Vec::new();
        };
        for (column_index, cell) in record.iter().enumerate() {
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
                context: format!("CSV cell [{line},{column}]"),
            });
        }
    }
    paths
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extract::PathType;

    #[test]
    fn a_blank_document_yields_nothing() {
        assert!(extract("").is_empty());
        assert!(extract(" \n ").is_empty());
    }

    #[test]
    fn positions_are_cell_coordinates() {
        let paths = extract("a,b\nx,/srv/f.txt\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position, Position { line: 2, column: 2 });
        assert_eq!(paths[0].context, "CSV cell [2,2]");
    }

    #[test]
    fn a_quoted_cell_may_contain_a_space() {
        let paths = extract("a\n\"./with space/f.png\"\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "./with space/f.png");
        assert_eq!(paths[0].kind, PathType::Relative);
    }

    #[test]
    fn cells_are_trimmed_before_the_heuristic_sees_them() {
        let paths = extract("a\n   /srv/f.txt   \n");
        assert_eq!(paths[0].value, "/srv/f.txt");
    }

    #[test]
    fn ragged_rows_are_data_not_an_error() {
        let paths = extract("a,b,c\n/one.txt\n/two.txt,/three.txt,/four.txt,/five.txt\n");
        assert_eq!(paths.len(), 5);
    }

    #[test]
    fn version_strings_and_plain_words_are_not_paths() {
        let paths = extract("version,name\n3.4.5,not-a-path\n");
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
        let paths = extract("a\n\u{85}/a.txt\n");
        assert_eq!(paths[0].value, "\u{85}/a.txt");
        assert_eq!(paths[0].kind, PathType::File);

        // U+FEFF is the mirror image — whitespace to JavaScript and not
        // to Rust — so it goes.
        let paths = extract("a\nx,\u{feff}/a.txt\n");
        assert_eq!(paths[0].value, "/a.txt");
        assert_eq!(paths[0].kind, PathType::Absolute);
    }

    #[test]
    fn a_byte_order_mark_does_not_corrupt_the_first_cell() {
        let paths = extract("\u{feff}/srv/f.txt\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].value, "/srv/f.txt");
    }

    #[test]
    fn empty_lines_do_not_shift_the_rows_after_them() {
        let paths = extract("a\n\n/srv/f.txt\n");
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0].position.line, 2);
    }
}
