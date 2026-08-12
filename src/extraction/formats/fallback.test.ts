import { describe, expect, it } from 'vitest';
import { extractFromFallback } from './fallback';

const values = (content: string) =>
	extractFromFallback(content).map((path) => path.value);

describe('extractFromFallback', () => {
	it('yields nothing for an empty document', () => {
		expect(extractFromFallback('')).toHaveLength(0);
		expect(extractFromFallback('   \n\t ')).toHaveLength(0);
	});

	it('claims the strong shapes without a delimiter', () => {
		expect(
			values('see /var/log/app.log and ./src/a.ts and ../up/b.ts'),
		).toEqual(['/var/log/app.log', './src/a.ts', '../up/b.ts']);
	});

	it('claims a Windows drive letter', () => {
		expect(values('copy C:\\Temp\\cache there')).toEqual(['C:\\Temp\\cache']);
	});

	/**
	 * The rule this module exists for. Nothing structural separates an
	 * attribute from a filename, so the delimiter does.
	 */
	it('does not mistake an attribute access for a file, but reads a quoted name', () => {
		expect(values('import os.path\nos.path.join(BASE)')).toHaveLength(0);
		expect(values('open("data.csv")')).toEqual(['data.csv']);
	});

	it('never claims a bare name.ext without a delimiter', () => {
		expect(values('README.md is the file')).toHaveLength(0);
		expect(values('`README.md` is the file')).toEqual(['README.md']);
	});

	it('claims an undelimited run that carries a separator', () => {
		expect(values('# see docs/architecture.md')).toEqual([
			'docs/architecture.md',
		]);
	});

	/**
	 * The regression that made the structure guard necessary: `//` is two
	 * characters, matches the Unix-absolute pattern, and starts a comment on
	 * most lines of most repositories.
	 */
	it('does not read a comment marker as an absolute path', () => {
		expect(values('// a note about ./x.ts')).toEqual(['./x.ts']);
		expect(values('///')).toHaveLength(0);
		expect(values('/* block */')).toHaveLength(0);
	});

	it('drops the punctuation wrapped around a path', () => {
		expect(values('[docs](./guide.md)')).toEqual(['./guide.md']);
		expect(values("load(['./a.ts', './b.ts'])")).toEqual(['./a.ts', './b.ts']);
		expect(values('PATH=/usr/local/bin')).toEqual(['/usr/local/bin']);
	});

	it('drops a trailing sentence mark', () => {
		expect(values('Read ./docs/a.md.')).toEqual(['./docs/a.md']);
		expect(values('at ./src/a.ts:')).toEqual(['./src/a.ts']);
	});

	it('allows spaces inside a delimited token and not outside one', () => {
		expect(values('f("/Users/me/My Files/a.txt")')).toEqual([
			'/Users/me/My Files/a.txt',
		]);
		expect(values('/Users/me/My Files/a.txt').length).toBeGreaterThan(1);
	});

	/** An apostrophe in prose must not swallow the paths after it. */
	it('treats an unterminated quote as no delimiter at all', () => {
		expect(values("# don't forget ./setup.sh")).toEqual(['./setup.sh']);
	});

	it('does not read a quoted run twice', () => {
		expect(values('x = "./once.ts"')).toEqual(['./once.ts']);
	});

	it('reports where the path starts', () => {
		const result = extractFromFallback('first line\nrun ./tool.sh now\n');
		expect(result).toHaveLength(1);
		expect(result[0]?.position).toEqual({ line: 2, column: 5 });
	});

	it('skips the opening quote in a position, as JSON does', () => {
		expect(extractFromFallback('x("./a.ts")')[0]?.position.column).toBe(4);
	});

	it('carries the scan context and a classification', () => {
		const result = extractFromFallback(
			'/abs/a.ts ./rel.ts https://example.com/x',
		);
		expect(result).toHaveLength(3);
		expect(result.every((path) => path.context === 'Text scan')).toBe(true);
		expect(result.map((path) => path.type)).toEqual([
			'absolute',
			'relative',
			'url',
		]);
	});

	it('rejects a glob whole rather than splitting it', () => {
		expect(values('src/**/*.ts')).toHaveLength(0);
	});

	it('still keeps version strings and addresses out', () => {
		expect(values('version 1.8.1 and 192.168.1.1')).toHaveLength(0);
	});

	it('keeps a path written in another script', () => {
		expect(values('開く /文書/報告')).toEqual(['/文書/報告']);
	});

	/**
	 * Token boundaries follow JavaScript's whitespace set, which the Rust CLI
	 * models deliberately: U+FEFF splits a run and U+0085 does not.
	 */
	it('splits runs on JavaScript whitespace', () => {
		expect(values('x /a/b\ufeffc')).toEqual(['/a/b']);
		expect(values('x /a/b\u0085c')).toEqual(['/a/b\u0085c']);
	});
});
