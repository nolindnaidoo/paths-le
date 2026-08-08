/**
 * Fails when the extension's extraction behaviour drifts from the shared
 * corpus, which the Rust CLI (crate/) also builds against.
 *
 * - extraction.json: every path the extension finds in each corpus
 *   document, with kind, 1-based position and context.
 * - heuristics.json: isPathLike and classifyPathType, the one heuristic
 *   every format extractor shares and the thing most likely to drift.
 * - mcp-extract-paths.json: the extract_paths tool, which BOTH MCP
 *   servers offer and must answer identically.
 *
 * This checks only the extension's side. `cargo test` runs the crate's
 * implementation over the same files. Neither is allowed to be the sole
 * author of a case.
 *
 * Run: bun scripts/check-extraction-parity.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractPaths } from '../src/extraction/extract';
import { classifyPathType, isPathLike } from '../src/extraction/heuristics';
import { TOOLS } from '../src/mcp/tools';

const ROOT = join(import.meta.dir, '..');
/** The corpus lives inside the crate so the published package is self-contained. */
const CORPUS = join(ROOT, 'crate', 'fixtures');
const failures: string[] = [];

function fail(message: string): void {
	failures.push(message);
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((item, i) => deepEqual(item, b[i]));
	}
	if (typeof a !== 'object' || typeof b !== 'object') return false;
	if (a === null || b === null) return false;
	const keysA = Object.keys(a).sort();
	const keysB = Object.keys(b).sort();
	if (!deepEqual(keysA, keysB)) return false;
	return keysA.every((key) =>
		deepEqual(
			(a as Record<string, unknown>)[key],
			(b as Record<string, unknown>)[key],
		),
	);
}

/** Drops `undefined` fields so results compare cleanly against plain JSON. */
function asJson(value: unknown): unknown {
	return JSON.parse(JSON.stringify(value));
}

function readCorpus(name: string): unknown {
	return JSON.parse(readFileSync(join(CORPUS, name), 'utf8'));
}

function readDocument(file: string): string {
	return readFileSync(join(CORPUS, 'documents', file), 'utf8');
}

async function checkExtraction(): Promise<void> {
	const cases = readCorpus('extraction.json') as ReadonlyArray<{
		name: string;
		file: string;
		languageId: string;
		expected: readonly unknown[];
	}>;

	for (const testCase of cases) {
		const result = await extractPaths(
			readDocument(testCase.file),
			testCase.languageId,
		);
		const actual = result.paths.map((path) => ({
			value: path.value,
			type: path.type,
			line: path.position.line,
			column: path.position.column,
			context: path.context,
		}));
		if (!deepEqual(actual, testCase.expected)) {
			fail(
				`extraction "${testCase.name}":\n  expected: ${JSON.stringify(testCase.expected)}\n  got:      ${JSON.stringify(actual)}`,
			);
		}
	}
}

function checkHeuristics(): void {
	const corpus = readCorpus('heuristics.json') as Readonly<{
		isPathLike: ReadonlyArray<{ input: string; expected: boolean }>;
		classifyPathType: ReadonlyArray<{ input: string; expected: string }>;
	}>;

	for (const testCase of corpus.isPathLike) {
		const actual = isPathLike(testCase.input);
		if (actual !== testCase.expected) {
			fail(
				`isPathLike ${JSON.stringify(testCase.input)}: expected ${testCase.expected}, got ${actual}`,
			);
		}
	}

	for (const testCase of corpus.classifyPathType) {
		const actual = classifyPathType(testCase.input);
		if (actual !== testCase.expected) {
			fail(
				`classifyPathType ${JSON.stringify(testCase.input)}: expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(actual)}`,
			);
		}
	}
}

/**
 * `extract_paths` is offered by BOTH MCP servers — this one, which ships
 * on npm and inside the extension, and the Rust CLI's. They are meant to
 * be the same tool, not two similar ones, so the same corpus runs against
 * both: this function here, and `crate/src/mcp/extract.rs`'s own test
 * there. A drift in either direction fails a build.
 */
async function checkMcpExtractPaths(): Promise<void> {
	const cases = readCorpus('mcp-extract-paths.json') as ReadonlyArray<{
		name: string;
		file?: string;
		content?: string;
		arguments: Record<string, unknown>;
		expected?: unknown;
		expectedError?: string;
	}>;

	const tool = TOOLS.find((t) => t.name === 'extract_paths');
	if (!tool) {
		fail('the extension no longer offers extract_paths');
		return;
	}

	for (const testCase of cases) {
		const args: Record<string, unknown> = { ...testCase.arguments };
		if (testCase.file !== undefined) {
			args.content = readDocument(testCase.file);
		} else if (testCase.content !== undefined) {
			args.content = testCase.content;
		}

		if (testCase.expectedError !== undefined) {
			try {
				await tool.handler(args);
				fail(
					`mcp extract "${testCase.name}": expected it to fail with ${JSON.stringify(testCase.expectedError)}`,
				);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				if (message !== testCase.expectedError) {
					fail(
						`mcp extract "${testCase.name}": expected error ${JSON.stringify(testCase.expectedError)}, got ${JSON.stringify(message)}`,
					);
				}
			}
			continue;
		}

		const actual = asJson(await tool.handler(args));
		if (!deepEqual(actual, testCase.expected)) {
			fail(
				`mcp extract "${testCase.name}":\n  expected: ${JSON.stringify(testCase.expected)}\n  got:      ${JSON.stringify(actual)}`,
			);
		}
	}
}

await checkExtraction();
checkHeuristics();
await checkMcpExtractPaths();

if (failures.length > 0) {
	console.error(`Extraction parity FAILED (${failures.length}):\n`);
	for (const failure of failures) {
		console.error(`- ${failure}\n`);
	}
	process.exit(1);
}
console.log(
	'OK: every corpus case reproduces under the extension, and both MCP servers agree.',
);
