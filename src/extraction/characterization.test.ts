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

	it('unsupported language returns format error', async () => {
		const result = await extractPaths('print("hi")', 'python');
		expect(result.success).toBe(false);
		expect(result.paths).toHaveLength(0);
		expect(result.errors[0]?.category).toBe('format');
	});
});
