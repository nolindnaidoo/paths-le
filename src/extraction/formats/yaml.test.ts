import { describe, expect, it } from 'vitest';
import type { Path } from '../../types';
import { extractFromYaml } from './yaml';

/** The paths of a document that reads; a refusal fails the test by name. */
function read(content: string): readonly Path[] {
	const result = extractFromYaml(content);
	if ('refusal' in result) throw new Error(result.refusal);
	return result.paths;
}

const values = (content: string) => read(content).map((path) => path.value);

describe('extractFromYaml', () => {
	it('yields nothing for a blank document', () => {
		expect(read('')).toHaveLength(0);
		expect(read('  \n ')).toHaveLength(0);
	});

	it('refuses a document that does not parse, and says why', () => {
		// It used to answer an empty list, which is also what a clean document
		// answers. The crate refuses with the same words.
		expect(extractFromYaml('secret: /etc/passwd\nbad: [unclosed\n')).toEqual({
			refusal: 'Invalid YAML: the document does not parse',
		});
	});

	it('refuses a document nested deeper than the bound', () => {
		const nested = (depth: number) =>
			`${'['.repeat(depth)}./x.ts${']'.repeat(depth)}`;
		expect(extractFromYaml(nested(97))).toEqual({
			refusal: 'Invalid YAML: nested deeper than 96 levels',
		});
		expect(read(nested(96)).map((p) => p.value)).toEqual(['./x.ts']);
	});

	it('extracts a scalar value with its position and kind', () => {
		const result = read('log: /var/log/app.log\n');
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('/var/log/app.log');
		expect(result[0]?.type).toBe('absolute');
		expect(result[0]?.context).toBe('YAML value');
		expect(result[0]?.position).toEqual({ line: 1, column: 6 });
	});

	it('counts a key that looks like a path', () => {
		const result = read('config/app.yaml: contents\n');
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('config/app.yaml');
		expect(result[0]?.context).toBe('YAML key');
	});

	it('follows sequences and nesting', () => {
		expect(
			values(
				'jobs:\n  build:\n    steps:\n      - ./scripts/a.sh\n      - ./scripts/b.sh\n',
			),
		).toEqual(['./scripts/a.sh', './scripts/b.sh']);
	});

	it('reads every document in a stream', () => {
		expect(values('a: ./one.ts\n---\nb: ./two.ts\n')).toEqual([
			'./one.ts',
			'./two.ts',
		]);
	});

	it('skips scalars the parser did not resolve to strings', () => {
		expect(values('port: 8080\nenabled: true\nempty: null\n')).toHaveLength(0);
	});

	it('follows the document order, not the alphabet', () => {
		const result = read('z: ./first.ts\na: ./second.ts\n');
		expect(result[0]?.value).toBe('./first.ts');
		expect(result[0]?.position.line).toBe(1);
		expect(result[1]?.position.line).toBe(2);
	});

	it('lands repeated values on successive occurrences', () => {
		const result = read('a: ./x.ts\nb: ./x.ts\n');
		expect(result[0]?.position.line).toBe(1);
		expect(result[1]?.position.line).toBe(2);
	});

	/**
	 * An alias expands to the anchor's value, which is behind the cursor by
	 * then. Answering with the definition is more useful than answering 1:1.
	 */
	it('resolves an aliased value to its anchor', () => {
		const result = read('base: &dir ./shared/lib.ts\nuse: *dir\n');
		expect(result).toHaveLength(2);
		expect(result[1]?.value).toBe('./shared/lib.ts');
		expect(result[1]?.position.line).toBe(1);
	});

	/** The 1:1 fallback: a folded scalar appears nowhere as written. */
	it('falls back to the first position for an unlocatable value', () => {
		const result = read('p: >-\n  ./spread\n  /out.ts\n');
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./spread /out.ts');
		expect(result[0]?.position).toEqual({ line: 1, column: 1 });
	});

	it('locates a quoted scalar past its quote', () => {
		const result = read('p: "./quoted.ts"\n');
		expect(result[0]?.position.column).toBe(5);
	});

	it('does not read a comment', () => {
		expect(values('# see ./notes.md\na: 1\n')).toHaveLength(0);
	});
});
