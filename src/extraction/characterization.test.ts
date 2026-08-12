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
});
