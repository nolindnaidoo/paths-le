import type { Path } from '../../types';
import { classifyPathType, isPathLike } from '../heuristics';
import { createPositionIndex, type PositionIndex } from '../position';

/**
 * The generic scan, for a document no typed extractor reads.
 *
 * Every other extractor hands `isPathLike` an already-delimited token — a JSON
 * string, an env value, a CSV cell — which is the assumption the heuristic is
 * written against. Raw text has no such token, so this produces them: a quoted
 * string is a delimited token and gets the whole heuristic, and everything else
 * is a run between whitespace and the punctuation that wraps a path in real
 * code, which gets a narrower one.
 *
 * **A bare `name.ext` run is not claimed.** `os.path`, `np.array` and
 * `logger.info` are `name.ext` to the shared heuristic and there is nothing
 * structural to tell them from `main.py`: an extension and an attribute are the
 * same shape, and separating them by dictionary is the TLD list already
 * declined for `example.com`. What does separate them is the delimiter — source
 * quotes its filenames and does not quote its attribute access — so an
 * undelimited run must carry a separator, while `open("data.csv")` still
 * reports `data.csv` because the quotes made it a token.
 */

/**
 * What the report says a generic scan found. Every typed extractor names the
 * construct it read (`JS import`, `TOML key`); this one has no construct to
 * name, so it names the mechanism instead.
 */
const CONTEXT = 'Text scan';

/**
 * Ends an undelimited run: the punctuation that wraps a path in real text — a
 * call's parentheses, an array's brackets, a list's commas, an assignment's
 * `=`.
 *
 * `<>|*?` are deliberately absent even though they are also delimiters in
 * places. They are forbidden inside a candidate anyway, so leaving them inside
 * the run rejects the whole token rather than salvaging a fragment of it:
 * `src/**\/*.ts` stays one rejected glob instead of becoming `src/` and `.ts`.
 */
const BREAKS = '()[]{},;=';

const QUOTES = '\'"`';

/**
 * Structure, as opposed to content. A candidate made of nothing else is not a
 * path: `//` opens a comment in half the languages in a repository and matches
 * the Unix-absolute pattern exactly, and `///` and `./..` are the same problem.
 *
 * Spelled as "not only these" rather than "contains a letter or digit" because
 * the two frontends have to agree character for character, and a JavaScript
 * property escape and Rust's `char::is_alphanumeric` are two Unicode tables
 * that can drift. This rule needs no table, and it keeps `/文書/報告`, which an
 * ASCII test would have thrown away.
 */
const STRUCTURE = '/\\.';

export function extractFromFallback(content: string): readonly Path[] {
	const toPosition = createPositionIndex(content);
	const paths: Path[] = [];

	let offset = 0;
	while (offset < content.length) {
		const current = content[offset] as string;

		if (QUOTES.includes(current)) {
			offset = readQuoted(content, offset + 1, current, paths, toPosition);
			continue;
		}

		if (isSeparator(current)) {
			offset += 1;
			continue;
		}

		let end = offset;
		while (end < content.length && !isBreak(content[end] as string)) {
			end += 1;
		}
		claim(offset, content.slice(offset, end), false, paths, toPosition);
		offset = end;
	}

	return paths;
}

/**
 * Read the body of a quoted run, returning where the scan resumes.
 *
 * **An unterminated quote is not a delimiter.** An apostrophe in a comment —
 * `# don't` — would otherwise swallow everything up to the next one, taking the
 * real paths in between with it, so the run has to close on the same line to
 * count.
 */
function readQuoted(
	content: string,
	start: number,
	quote: string,
	paths: Path[],
	toPosition: PositionIndex,
): number {
	let at = start;
	while (at < content.length && content[at] !== quote && content[at] !== '\n') {
		at += 1;
	}
	if (content[at] !== quote) return start;

	claim(start, content.slice(start, at), true, paths, toPosition);
	return at + 1;
}

function isSeparator(character: string): boolean {
	return /\s/.test(character) || BREAKS.includes(character);
}

function isBreak(character: string): boolean {
	return isSeparator(character) || QUOTES.includes(character);
}

function claim(
	offset: number,
	token: string,
	delimited: boolean,
	paths: Path[],
	toPosition: PositionIndex,
): void {
	const body = token.trimStart();
	const leading = token.length - body.length;
	// A delimited token is taken as written, minus the whitespace the quote
	// happened to include; an undelimited one loses the sentence punctuation
	// that ends it, so `see ./docs/a.md.` reports the file and not the stop.
	const value = delimited ? body.trim() : body.replace(/[.:]+$/, '');

	if ([...value].every((character) => STRUCTURE.includes(character))) return;
	if (!delimited && !value.includes('/') && !value.includes('\\')) return;
	if (!isPathLike(value)) return;

	paths.push({
		value,
		type: classifyPathType(value),
		position: toPosition(offset + leading),
		context: CONTEXT,
	});
}
