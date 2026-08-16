import type { Extracted, Path } from '../../types';
import { classifyPathType, isPathLike } from '../heuristics';

/**
 * The byte between cells, and the name the context line goes by.
 *
 * Tab-separated files are the same grammar with a different delimiter,
 * and reading one on commas made every row a single cell — never
 * path-like, so the document reported nothing at all. Held equal to the
 * crate's `COMMA`/`TAB` by the shared corpus.
 */
export const COMMA = ',';
export const TAB = '\t';

const QUOTE = '"';
/** The same character as a UTF-16 unit, so the hot loop compares a number. */
const QUOTE_UNIT = QUOTE.charCodeAt(0);

/**
 * The row separators the reader discovers, in its order of preference.
 * Windows before the classic Mac ending, or every `\r\n` would read as a
 * `\r` row followed by an empty one.
 */
const ENDINGS = ['\r\n', '\n', '\r'] as const;

/**
 * JavaScript's own whitespace — `WhiteSpace` plus `LineTerminator` from the
 * language spec, which is exactly what `\s` matches and exactly what the
 * crate's `js` module spells out by hand to match it. Tested one code point at
 * a time, so an astral character is never half-matched.
 */
const SPACE = /^\s$/u;

/** Why the reader gave up. */
type Reason = 'unterminated' | 'after-closing-quote';

/**
 * What each refusal says. Two messages rather than one, because the message is
 * the only place a reader learns which malformation happened, and "invalid CSV"
 * on its own gives them nothing to act on. Held byte-identical to the crate's.
 */
const REASONS: Readonly<Record<Reason, string>> = Object.freeze({
	unterminated: 'quoted field is never closed',
	'after-closing-quote': 'a closing quote is followed by more than whitespace',
});

/**
 * Why the reader gave up, and where.
 *
 * The coordinates are the ones a reported path carries — the row number and the
 * cell index, both counted from one — so "row 2, cell 3" names the same place in
 * the document as `CSV cell [2,3]` does. A byte offset would not: the two
 * frontends count a document's length in different units, and this message has
 * to come out byte-identical from both.
 */
type Refusal = {
	readonly reason: Reason;
	readonly row: number;
	readonly cell: number;
};

/** The cell being read. */
type Cell = {
	text: string;
	/**
	 * Set by the closing quote and cleared only when the cell ends. It is what
	 * keeps the cell's own whitespace, and what turns everything after the
	 * closing quote into either whitespace or a refusal.
	 */
	wasQuoted: boolean;
	/** Whether the scan is between the quotes. */
	quoting: boolean;
};

/** What the reader made of a document. */
type Read =
	| { readonly records: readonly (readonly string[])[] }
	| { readonly refusal: Refusal };

/** One step: where to read from next, and the row separator as it now stands. */
type Step = { readonly at: number; readonly ending: string };

/**
 * Extract path-like cells from CSV.
 * Positions are cell coordinates — line is the row number, column is
 * the cell index (not a character offset); the context repeats both.
 */
export function extractFromCsv(
	content: string,
	delimiter: string = COMMA,
): Extracted {
	if (content.trim().length === 0) return { paths: [] };
	const label = delimiter === TAB ? 'TSV' : 'CSV';

	// `csv-parse` was asked to strip a byte-order mark; this reader does it
	// itself, or a leading BOM becomes part of the first header cell.
	const document = content.startsWith('\ufeff') ? content.slice(1) : content;

	// A refused document says why. It used to report nothing at all — the
	// reader threw and the `catch` returned `[]` — so a document holding
	// `/etc/passwd` came back as no paths and no diagnostics, which is
	// indistinguishable from a file that is genuinely clean. Still no partial
	// answer: a half-read CSV would report positions that do not correspond to
	// the file.
	const read = readRows(document, delimiter);
	if ('refusal' in read) return { refusal: message(read.refusal, label) };

	const paths: Path[] = [];

	for (let rowIndex = 0; rowIndex < read.records.length; rowIndex++) {
		const row = read.records[rowIndex] ?? [];
		for (let colIndex = 0; colIndex < row.length; colIndex++) {
			// The reader trims what it can as it goes; this is the
			// `String.prototype.trim` on top, which the crate spells `js::trim`.
			const cell = (row[colIndex] ?? '').trim();
			if (!isPathLike(cell)) continue;
			paths.push({
				value: cell,
				type: classifyPathType(cell),
				position: { line: rowIndex + 1, column: colIndex + 1 },
				context: `${label} cell [${rowIndex + 1},${colIndex + 1}]`,
			});
		}
	}

	return { paths };
}

/**
 * `label` is the name the context line goes by, so a tab-separated document is
 * not reported as an invalid CSV.
 */
function message(refusal: Refusal, label: string): string {
	return `Invalid ${label}: ${REASONS[refusal.reason]} (row ${refusal.row}, cell ${refusal.cell})`;
}

/**
 * The reader, rule for rule with the crate's `extract/csv.rs` — `csv-parse`
 * under `trim`, `relax_quotes`, `skip_empty_lines` and `relax_column_count`.
 *
 * Written out here rather than delegated, because `csv-parse` *throws* on a
 * malformed quote: there is no way to learn from it which malformation happened
 * or where, and no way to stop it refusing a document over a no-break space
 * after a closing quote — it walks that whitespace run one byte at a time. Two
 * readers spelled out in two languages, held equal by the shared corpus, is the
 * only shape in which both frontends can answer the same way.
 *
 * A `refusal` is what the `catch` used to swallow, and exactly two things
 * produce it: a quote left open at the end of the document, and anything but
 * whitespace between a closing quote and the end of its cell.
 */
function readRows(content: string, delimiter: string): Read {
	const records: string[][] = [];
	let record: string[] = [];
	const cell: Cell = { text: '', wasQuoted: false, quoting: false };
	let ending = '';
	let at = 0;

	const refuse = (reason: Reason): Read => ({
		// Where the reader stands: the rows it has finished and the cells it has
		// taken, both counted from one.
		refusal: { reason, row: records.length + 1, cell: record.length + 1 },
	});

	while (at < content.length) {
		if (cell.quoting) {
			const step = readQuoted(cell, content, at, delimiter, ending);
			if (typeof step === 'string') return refuse(step);
			ending = step.ending;
			at = step.at;
			continue;
		}

		// The row separator is whatever ends the first row outside a quoted
		// cell, and it is fixed from there: in a `\n` document a stray `\r` is
		// text.
		if (ending === '') ending = lineEnding(content, at);

		if (ending !== '' && content.startsWith(ending, at)) {
			at += ending.length;
			// A row that produced no cell at all is dropped, so a blank line does
			// not shift the rows after it.
			if (!cell.wasQuoted && cell.text === '' && record.length === 0) continue;
			record.push(take(cell));
			records.push(record);
			record = [];
			continue;
		}

		if (content.startsWith(delimiter, at)) {
			record.push(take(cell));
			at += delimiter.length;
			continue;
		}

		// A quote opens a cell only where nothing precedes it. Anywhere else it
		// is literal text, and that is the whole of what `relax_quotes` relaxes.
		if (content.charCodeAt(at) === QUOTE_UNIT && cell.text === '') {
			cell.quoting = true;
			at += QUOTE.length;
			continue;
		}

		const step = push(cell, content, at);
		if (typeof step === 'string') return refuse(step);
		at += step;
	}

	if (cell.quoting) return refuse('unterminated');
	if (cell.wasQuoted || cell.text !== '' || record.length > 0) {
		record.push(take(cell));
		records.push(record);
	}
	return { records };
}

/** One step inside `"…"`, or the reason the document is refused. */
function readQuoted(
	cell: Cell,
	content: string,
	at: number,
	delimiter: string,
	ending: string,
): Step | Reason {
	// A doubled quote is one quote of text, and it can never be the closing one.
	// The reader steps over the first and takes the second as an ordinary
	// character, so it goes through `push` like one.
	if (content.startsWith('""', at)) {
		// The second of the pair is the one that becomes text, and pushing it
		// where it stands keeps this the same call as any other character.
		const step = push(cell, content, at + QUOTE.length);
		if (typeof step === 'string') return step;
		return { at: at + 2 * QUOTE.length, ending };
	}

	if (content.charCodeAt(at) !== QUOTE_UNIT) {
		const step = push(cell, content, at);
		if (typeof step === 'string') return step;
		return { at: at + step, ending };
	}

	const after = at + QUOTE.length;
	const found = ending === '' ? lineEnding(content, after) : ending;
	// `relax_quotes` nominally keeps the rest of a cell whose quoting is
	// malformed, but `trim` makes that path unreachable: the reader puts the
	// quote back, reads it again, and refuses it as a non-trimable character
	// after a closing quote. Refusing here is the same answer one step earlier —
	// and it is the honest one. `"./a",b` read on tabs is not the path `./a,b`;
	// it is a cell somebody quoted wrong.
	if (!closes(content, after, delimiter, found)) return 'after-closing-quote';

	cell.quoting = false;
	cell.wasQuoted = true;
	return { at: after, ending: found };
}

/** Whether a closing quote here really closes the cell. */
function closes(
	content: string,
	after: number,
	delimiter: string,
	ending: string,
): boolean {
	if (after >= content.length) return true;
	if (content.startsWith(delimiter, after)) return true;
	if (ending !== '' && content.startsWith(ending, after)) return true;
	return SPACE.test(codePointAt(content, after));
}

/**
 * The finished text. A quoted cell keeps the whitespace inside its quotes; an
 * unquoted one is right-trimmed, its left side having been dropped as it was
 * read.
 */
function take(cell: Cell): string {
	const text = cell.wasQuoted ? cell.text : cell.text.trimEnd();
	cell.text = '';
	cell.wasQuoted = false;
	return text;
}

/**
 * One character of text, which decides both what the cell keeps and how far the
 * scan moves — `csv-parse` folds the two together. A `Reason` refuses the
 * document.
 *
 * A cell that has been through a closing quote keeps nothing more, whether or
 * not a later quote re-opened it: whitespace may stand between the closing
 * quote and the end of the cell, and nothing else may.
 */
function push(cell: Cell, content: string, at: number): number | Reason {
	const size = codePointSize(content, at);

	// The common case, and the reason it comes first: a cell already holding
	// text keeps whatever follows, so whether this character is whitespace never
	// has to be decided. Asking on every character of a large document costs
	// more than the rest of the scan put together.
	if (!cell.wasQuoted && (cell.quoting || cell.text !== '')) {
		cell.text += content.slice(at, at + size);
		return size;
	}

	const character = content.slice(at, at + size);
	const space = SPACE.test(character);
	if (!space && !cell.wasQuoted) {
		cell.text += character;
		return size;
	}
	if (!space) return 'after-closing-quote';
	// Whitespace the reader drops: leading whitespace, or the run after a
	// closing quote. `csv-parse` steps a whole character over the first and a
	// single *byte* over the second, so a multi-byte space there landed
	// mid-sequence next time round, where no separator, quote or space can
	// match, and refused a document nobody had mis-quoted. U+00A0 and U+FEFF are
	// ordinary things to find in a spreadsheet export, so the whole character is
	// stepped over on both frontends now: whitespace is whitespace whatever its
	// encoded length.
	return size;
}

function lineEnding(content: string, at: number): string {
	return ENDINGS.find((ending) => content.startsWith(ending, at)) ?? '';
}

/**
 * How many UTF-16 units the code point at `at` occupies — the scan advances by
 * this, never by one unit, so a `\u{1f4c1}` in a cell is one step here and one
 * `char` in the crate. A lone surrogate is one step, as `codePointAt` treats
 * it.
 */
function codePointSize(content: string, at: number): number {
	const unit = content.charCodeAt(at);
	if (unit < 0xd800 || unit > 0xdbff) return 1;
	const trailing = content.charCodeAt(at + 1);
	return trailing >= 0xdc00 && trailing <= 0xdfff ? 2 : 1;
}

/** The whole code point at `at`, never half a surrogate pair. */
function codePointAt(content: string, at: number): string {
	return content.slice(at, at + codePointSize(content, at));
}
