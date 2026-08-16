import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractPaths } from './extract';

/**
 * Characterization tests: pin the CURRENT extraction output per format,
 * including known bugs (multiline imports missed, JSON/TOML positions
 * hardcoded to 1:1, dotenv double-emission, semver false positives,
 * JSONC comments failing to parse). Behavior changes must update these
 * snapshots in the same commit, so every output diff is explicit.
 */

const FIXTURES: ReadonlyArray<{ fixture: string; languageId: string }> = [
	{ fixture: 'paths.js', languageId: 'javascript' },
	{ fixture: 'paths.js', languageId: 'typescript' },
	{ fixture: 'paths.json', languageId: 'json' },
	{ fixture: 'comments.jsonc', languageId: 'jsonc' },
	{ fixture: 'paths.toml', languageId: 'toml' },
	{ fixture: 'paths.csv', languageId: 'csv' },
	{ fixture: 'paths.env', languageId: 'dotenv' },
	{ fixture: 'paths.css', languageId: 'css' },
	{ fixture: 'paths.html', languageId: 'html' },
	{ fixture: 'paths.yml', languageId: 'yaml' },
	{ fixture: 'paths.py', languageId: 'python' },
];

describe('extraction characterization', () => {
	for (const { fixture, languageId } of FIXTURES) {
		it(`${fixture} as ${languageId}`, async () => {
			const content = readFileSync(
				join(__dirname, '__fixtures__', fixture),
				'utf8',
			);
			const result = await extractPaths(content, languageId);
			expect(result).toMatchSnapshot();
		});
	}

	/**
	 * Changed deliberately: a language with no typed extractor used to return a
	 * format error and no paths. It is read by the generic scan now, which is
	 * why `paths.py` is a fixture above rather than a refusal here.
	 */
	it('a language with no typed extractor is scanned, not refused', async () => {
		const result = await extractPaths('open("./data/in.csv")', 'python');
		expect(result.success).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.paths.map((path) => path.value)).toEqual(['./data/in.csv']);
	});

	/**
	 * The one extractor that refuses, and the only reason the engine has an error
	 * channel at all. A refusal that reported no paths and no error would be
	 * indistinguishable from a clean document — this asserts the difference is
	 * observable at the engine, not only at the MCP envelope.
	 */
	it('a document its reader refused fails with the reason named', async () => {
		const result = await extractPaths('"name,size\n/etc/passwd,1\n', 'csv');
		expect(result.success).toBe(false);
		expect(result.paths).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.category).toBe('parsing');
		expect(result.errors[0]?.severity).toBe('error');
		expect(result.errors[0]?.message).toBe(
			'Invalid CSV: quoted field is never closed (row 1, cell 1)',
		);
	});

	it('a tab-separated document its reader refused says TSV', async () => {
		const result = await extractPaths('"./no-extension",two\n1,2\n', 'tsv');
		expect(result.success).toBe(false);
		expect(result.errors[0]?.message).toBe(
			'Invalid TSV: a closing quote is followed by more than whitespace (row 1, cell 1)',
		);
	});
});
