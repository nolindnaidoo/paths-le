import { describe, expect, it } from 'vitest';
import type { Path } from '../../types';
import { COMMA, extractFromCsv, TAB } from './csv';

/**
 * The reader is a port of the crate's `extract/csv.rs`, so the cases here are
 * its cases. Both sides carry them, because a regression fixed on one frontend
 * only is how the two stop agreeing.
 */

/** The paths of a document that reads. */
function read(content: string, delimiter: string = COMMA): readonly Path[] {
	const result = extractFromCsv(content, delimiter);
	if ('refusal' in result) {
		throw new Error(`expected the document to read: ${result.refusal}`);
	}
	return result.paths;
}

/** The message of a document that does not. */
function refusal(content: string, delimiter: string = COMMA): string {
	const result = extractFromCsv(content, delimiter);
	if (!('refusal' in result)) {
		throw new Error(`expected a refusal, got ${JSON.stringify(result.paths)}`);
	}
	return result.refusal;
}

describe('extractFromCsv', () => {
	it('should extract paths from CSV with headers', () => {
		const content = `Name,Path,Type
config,/etc/app/config.json,file
log,./logs/app.log,file
data,C:\\data\\app.db,file`;

		const result = read(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/etc/app/config.json');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[2]?.value).toBe('C:\\data\\app.db');
	});

	it('should extract paths from CSV without headers', () => {
		const content = `config,/etc/app/config.json,file
log,./logs/app.log,file
data,C:\\data\\app.db,file`;

		const result = read(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/etc/app/config.json');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[2]?.value).toBe('C:\\data\\app.db');
	});

	it('should handle mixed data types', () => {
		const content = `ID,Name,Path,Status
1,app,/usr/bin/app,active
2,config,/home/user/.config/app.yaml,active
3,cache,./cache/temp,inactive`;

		const result = read(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/usr/bin/app');
		expect(result[1]?.value).toBe('/home/user/.config/app.yaml');
		expect(result[2]?.value).toBe('./cache/temp');
	});

	it('should handle empty content', () => {
		expect(read('')).toHaveLength(0);
		expect(read(' \n ')).toHaveLength(0);
	});

	it('reads a document with no quoting in it at all', () => {
		expect(read('invalid,csv,content\nwith,broken,structure')).toHaveLength(0);
	});

	it('should include position information', () => {
		const result = read('Name,Path\nconfig,/etc/app/config.json');
		expect(result[0]?.position).toEqual({ line: 2, column: 2 });
	});

	it('should include context information', () => {
		const result = read('Name,Path\nconfig,/etc/app/config.json');
		expect(result[0]?.context).toBe('CSV cell [2,2]');
	});

	it('should classify path types correctly', () => {
		const content = `Type,Path
absolute,/etc/app/config.json
relative,./logs/app.log
windows,C:\\data\\app.db
url,https://api.example.com/v1/data`;

		const result = read(content);
		expect(result[0]?.type).toBe('absolute');
		expect(result[1]?.type).toBe('relative');
		expect(result[2]?.type).toBe('absolute');
		expect(result[3]?.type).toBe('url');
	});

	/**
	 * The delimiter is the whole fix: read on commas, a tab row is one cell,
	 * which is never path-like, so a `.tsv` full of paths reported nothing.
	 */
	it('reads a tab row as cells under TAB and as one cell under COMMA', () => {
		const content = 'name\tpath\nalpha\t./src/a.ts\n';
		const tabbed = read(content, TAB);
		expect(tabbed).toHaveLength(1);
		expect(tabbed[0]?.value).toBe('./src/a.ts');
		expect(tabbed[0]?.context).toBe('TSV cell [2,2]');
		expect(read(content, COMMA)).toHaveLength(0);
	});

	it('keeps a quoted cell whole, spaces and delimiters and all', () => {
		expect(read('a\n"./with space/f.png"\n')[0]?.value).toBe(
			'./with space/f.png',
		);
		expect(read('a\n"./a,b.txt",2\n')[0]?.value).toBe('./a,b.txt');
		// A doubled quote is one quote of text and never the closing one, so the
		// cell after it is still a cell rather than a refusal.
		expect(read('a\n"x""y",/b.txt\n')[0]?.position).toEqual({
			line: 2,
			column: 2,
		});
	});

	it('treats ragged rows as data rather than an error', () => {
		expect(
			read('a,b,c\n/one.txt\n/two.txt,/three.txt,/four.txt,/five.txt\n'),
		).toHaveLength(5);
	});

	it('strips a byte-order mark rather than gluing it to the first cell', () => {
		expect(read('\ufeff/srv/f.txt\n')[0]?.value).toBe('/srv/f.txt');
	});

	it('does not let a blank row shift the rows after it', () => {
		expect(read('a\n\n/srv/f.txt\n')[0]?.position.line).toBe(2);
		expect(read('a\n   \n/srv/f.txt\n')[0]?.position.line).toBe(2);
		// U+0085 is not whitespace to JavaScript, so a row holding one is a row.
		expect(read('a\n\u0085\n/srv/f.txt\n')[0]?.position.line).toBe(3);
	});

	it('fixes the row separator on whichever one came first', () => {
		expect(read('a,b\nc\r\n/d.txt\n')[0]?.position.line).toBe(3);
		// A `\n` inside a `\r\n` document is text, so both paths land in one cell.
		expect(read('a,b\r\n/c.txt\n/d.txt\r\n')[0]?.value).toBe('/c.txt\n/d.txt');
	});

	it('keeps a last cell that ends the document without a row separator', () => {
		const result = read('one,two\n"./x.ts",2');
		expect(result).toHaveLength(1);
		expect(result[0]?.position).toEqual({ line: 2, column: 1 });
	});

	/**
	 * The regression this reader exists for. Both frontends used to answer an
	 * empty result with an empty `diagnostics` — a document holding
	 * `/etc/passwd` reading as a file that is clean.
	 */
	describe('a refused document names the malformation', () => {
		it('names a quote nobody closed, and where', () => {
			expect(refusal('"name,size\n/etc/passwd,1\n')).toBe(
				'Invalid CSV: quoted field is never closed (row 1, cell 1)',
			);
			expect(refusal('a,b\nc,"never closed\n')).toBe(
				'Invalid CSV: quoted field is never closed (row 2, cell 2)',
			);
		});

		it('names a cell that carried on past its closing quote, and where', () => {
			expect(refusal('"a"x,size\n/etc/passwd,1\n')).toBe(
				'Invalid CSV: a closing quote is followed by more than whitespace (row 1, cell 1)',
			);
			expect(refusal('a,b\nc,d\ne,"f"x\n')).toBe(
				'Invalid CSV: a closing quote is followed by more than whitespace (row 3, cell 2)',
			);
		});

		it('reports a tab-separated document as a TSV', () => {
			expect(refusal('"./no-extension",two\n1,2\n', TAB)).toBe(
				'Invalid TSV: a closing quote is followed by more than whitespace (row 1, cell 1)',
			);
			expect(refusal('"unterminated\n', TAB)).toBe(
				'Invalid TSV: quoted field is never closed (row 1, cell 1)',
			);
		});

		it('refuses every spelling of malformed quoting', () => {
			for (const delimiter of [COMMA, TAB]) {
				expect(refusal('"abc"def\n', delimiter)).toContain('closing quote');
				expect(refusal('  "a"  x,b\n', delimiter)).toContain('closing quote');
				expect(refusal('"abc"x', delimiter)).toContain('closing quote');
				expect(refusal('"unterminated\n', delimiter)).toContain('never closed');
				expect(refusal('"', delimiter)).toContain('never closed');
				// The doubled quote swallowed the closing one.
				expect(refusal('"a""\n', delimiter)).toContain('never closed');
			}
		});

		it('abandons every row, including the good ones', () => {
			expect(refusal('"a"x,/real/path.txt\n')).toContain('closing quote');
		});

		/**
		 * The same bytes on the other delimiter are well-formed and still read —
		 * `"./a",b` on tabs is a cell somebody quoted wrong, not the path
		 * `./a,b`.
		 */
		it('reads a document the other delimiter would refuse', () => {
			const result = read('"./no-extension",two\n1,2\n', COMMA);
			expect(result).toHaveLength(1);
			expect(result[0]?.value).toBe('./no-extension');
		});
	});

	/**
	 * `csv-parse` walked the whitespace after a closing quote one *byte* at a
	 * time, so a no-break space refused where a plain space was skipped. A
	 * spreadsheet export carrying one reported none of its paths.
	 */
	describe('whitespace after a closing quote', () => {
		const document = (space: string) =>
			`"name"${space},size\n/etc/passwd,1\n/var/log/app.log,2\n`;

		it('is whitespace whatever its encoded length', () => {
			for (const space of [
				' ',
				'\u00a0',
				'\ufeff',
				'\u2028',
				'\u2003',
				'\u3000',
			]) {
				const result = read(document(space));
				expect(result.map((path) => path.value)).toEqual([
					'/etc/passwd',
					'/var/log/app.log',
				]);
			}
		});

		it('is skipped in a run, not just on its own', () => {
			expect(read(document(' \u00a0 '))).toHaveLength(2);
			expect(read('"a" \u00a0,/b.txt\n')[0]?.value).toBe('/b.txt');
		});

		/**
		 * Whitespace is all that may stand there. A cell that re-opens its quotes
		 * has still been through a closing one, so the re-opened section may hold
		 * no text — the pair of answers the randomised cross-check found.
		 */
		it('does not make the rest of the cell readable', () => {
			expect(refusal('"" "./b.ts"\n')).toContain('closing quote');
			expect(refusal('"" \ufeff"./b.ts"\r/c.md', TAB)).toContain(
				'closing quote',
			);
			expect(read('"" "" ')).toHaveLength(0);
		});
	});

	/**
	 * A regression the generated differential found: the trim has to be
	 * JavaScript's. U+0085 is whitespace to Rust and not here, and U+FEFF is the
	 * mirror image.
	 */
	it('trims cells with JavaScript whitespace', () => {
		expect(read('a\n   /srv/f.txt   \n')[0]?.value).toBe('/srv/f.txt');

		const kept = read('a\n\u0085/a.txt\n');
		expect(kept[0]?.value).toBe('\u0085/a.txt');
		expect(kept[0]?.type).toBe('file');

		const dropped = read('a\nx,\ufeff/a.txt\n');
		expect(dropped[0]?.value).toBe('/a.txt');
		expect(dropped[0]?.type).toBe('absolute');
	});

	it('does not report a version string or a plain word', () => {
		expect(read('version,name\n3.4.5,not-a-path\n')).toHaveLength(0);
	});
});
