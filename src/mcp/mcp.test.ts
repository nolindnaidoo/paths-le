import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type { ExtractionResult } from '../types';
import { capped, isOk, readMaxResults, toDiagnostics } from './envelope';
import { FALLBACK_FORMAT, resolveFormat, SUPPORTED_FORMATS } from './fileType';
import { TOOLS } from './tools';
import { createResponder, serve } from './transport';

/**
 * The MCP layer: the normalisation boundary, the tool table and the protocol.
 *
 * The engine is covered by its own characterization goldens. What is new here
 * is the translation between an agent's request and that engine — which is
 * where the interesting mistakes live: failing a result over an informational
 * diagnostic, letting an unbounded extraction flood a context window, or
 * renaming a tool that something already depends on.
 */

const emptyResult: ExtractionResult = Object.freeze({
	success: true,
	paths: Object.freeze([]),
	errors: Object.freeze([]),
});

const withError = (severity: 'info' | 'warning' | 'error') => ({
	...emptyResult,
	errors: [
		{
			category: 'parsing' as const,
			severity,
			message: 'bad',
			recoverable: false,
			recoveryAction: 'none' as const,
			timestamp: 0,
		},
	],
});

describe('envelope: ok vs success', () => {
	it('treats an empty result with no errors as ok', () => {
		expect(isOk(toDiagnostics(emptyResult))).toBe(true);
	});

	it('is not ok when the engine reported an error', () => {
		expect(isOk(toDiagnostics(withError('error')))).toBe(false);
	});

	it('does not fail a result over an informational diagnostic', () => {
		// The engine has three severities and a diagnostic has two. Folding `info`
		// into `error` would fail results that are completely fine.
		const diagnostics = toDiagnostics(withError('info'));
		expect(diagnostics[0]?.severity).toBe('warning');
		expect(isOk(diagnostics)).toBe(true);
	});
});

describe('envelope: result cap', () => {
	it('reports truncation honestly when it drops items', () => {
		const { items, truncated } = capped([1, 2, 3, 4, 5], 2);
		expect(items).toEqual([1, 2]);
		expect(truncated).toBe(true);
	});

	it('does not claim truncation when everything fits', () => {
		const { items, truncated } = capped([1, 2], 5);
		expect(items).toHaveLength(2);
		expect(truncated).toBe(false);
	});

	it('rejects a maxResults a tool cannot honour', () => {
		expect(() => readMaxResults({ maxResults: 0 })).toThrow(/positive integer/);
		expect(() => readMaxResults({ maxResults: 1.5 })).toThrow();
		expect(() => readMaxResults({ maxResults: 'ten' })).toThrow();
	});

	it('clamps an oversized request rather than refusing it', () => {
		expect(readMaxResults({ maxResults: 999999 })).toBe(5000);
	});
});

describe('fileType: tolerant resolution', () => {
	it('accepts the language ids the engine already knows', () => {
		expect(resolveFormat('json', undefined)).toBe('json');
	});

	it('accepts the shorthands an agent actually sends', () => {
		expect(resolveFormat('jsonc', undefined)).toBe('json');
		expect(resolveFormat('.TSX', undefined)).toBe('typescript');
		expect(resolveFormat(' jsx ', undefined)).toBe('javascript');
	});

	it('resolves a dotfile whose whole name is the type', () => {
		// `.env` has no extension to split on, and it is the filename an agent
		// sends most often here.
		expect(resolveFormat(undefined, '.env')).toBe('dotenv');
	});

	it('infers from a filename when no format is given', () => {
		expect(resolveFormat(undefined, 'tsconfig.json')).toBe('json');
		expect(resolveFormat(undefined, 'Cargo.toml')).toBe('toml');
	});

	it('falls back to the generic scan when neither input resolves', () => {
		// Changed deliberately: this used to return null and the tool refused.
		// Every name resolves now, so a document nobody can name is still read.
		expect(resolveFormat('klingon', 'a.klingon')).toBe(FALLBACK_FORMAT);
		expect(resolveFormat(undefined, undefined)).toBe(FALLBACK_FORMAT);
	});

	it('resolves yaml under both of its spellings', () => {
		expect(resolveFormat(undefined, 'ci.yml')).toBe('yaml');
		expect(resolveFormat(undefined, 'deployment.yaml')).toBe('yaml');
	});

	it('advertises only formats the engine supports', () => {
		expect(SUPPORTED_FORMATS).toContain('json');
		expect(SUPPORTED_FORMATS).toContain('yaml');
		// The generic scan is what a caller gets by naming nothing, never a
		// format to name — offering it would be offering "no format".
		expect(SUPPORTED_FORMATS).not.toContain(FALLBACK_FORMAT);
	});
});

describe('tool table', () => {
	it('pins the tool names', () => {
		expect(TOOLS.map((t) => t.name)).toEqual(['extract_paths']);
	});

	it('gives every tool a description and a closed schema', () => {
		for (const tool of TOOLS) {
			expect(tool.description.length).toBeGreaterThan(20);
			expect(tool.inputSchema.type).toBe('object');
			expect(tool.inputSchema.additionalProperties).toBe(false);
			expect(typeof tool.handler).toBe('function');
		}
	});

	it('caps results by default rather than leaving it unbounded', () => {
		const schema = TOOLS[0]?.inputSchema as {
			properties: { maxResults: { default: number } };
		};
		expect(schema.properties.maxResults.default).toBe(500);
	});
});

describe('extract_paths', () => {
	const call = async (args: Record<string, unknown>) => {
		const tool = TOOLS[0];
		if (!tool) throw new Error('no tool');
		return (await tool.handler(args)) as {
			ok: boolean;
			data: {
				fileType: string;
				paths: { value: string; type: string; line?: number }[];
			};
			diagnostics: { severity: string; code: string; message: string }[];
			meta: { count: number; truncated: boolean };
		};
	};

	it('extracts with positions and a classification', async () => {
		const result = await call({
			content: '{"main": "./src/index.ts"}',
			format: 'json',
		});
		expect(result.data.paths[0]?.value).toBe('./src/index.ts');
		expect(result.data.paths[0]?.type).toBe('relative');
		expect(result.data.paths[0]?.line).toBe(1);
		expect(result.ok).toBe(true);
	});

	it('collapses repeats only when asked', async () => {
		const content = '{"a": "./src/index.ts", "b": "./src/index.ts"}';
		const kept = await call({ content, format: 'json' });
		const deduped = await call({ content, format: 'json', dedupe: true });
		expect(kept.meta.count).toBe(2);
		expect(deduped.meta.count).toBe(1);
	});

	it('truncates at maxResults and says so', async () => {
		const content = JSON.stringify(
			Object.fromEntries(
				Array.from({ length: 10 }, (_, i) => [`k${i}`, `./src/f${i}.ts`]),
			),
		);
		const result = await call({ content, format: 'json', maxResults: 3 });
		expect(result.meta.count).toBe(3);
		expect(result.meta.truncated).toBe(true);
	});

	it('scans generically when no usable format is given', async () => {
		// Changed deliberately: this used to refuse with "Provide `format`".
		const result = await call({ content: 'run ./src/index.ts' });
		expect(result.data.fileType).toBe(FALLBACK_FORMAT);
		expect(result.data.paths).toEqual([
			{ value: './src/index.ts', type: 'relative', line: 1, column: 5 },
		]);
	});

	it('reads a yaml document with its own extractor', async () => {
		const result = await call({
			content: 'steps:\n  - run: ./scripts/build.sh\n',
			filename: 'ci.yml',
		});
		expect(result.data.fileType).toBe('yaml');
		expect(result.data.paths).toEqual([
			{ value: './scripts/build.sh', type: 'relative', line: 2, column: 10 },
		]);
	});

	it('requires content', async () => {
		await expect(call({ format: 'json' })).rejects.toThrow(
			/content is required/,
		);
	});

	/**
	 * The refusal has to reach the caller. A malformed CSV holding `/etc/passwd`
	 * used to come back as an empty result with an empty `diagnostics`, which a
	 * model reads as a file that is clean — the silent miss this tool exists to
	 * prevent. `fixtures/mcp-extract-paths.json` pins the same envelope against
	 * the crate's server.
	 */
	it('names a document its reader refused', async () => {
		const result = await call({
			content: '"name,size\n/etc/passwd,1\n',
			format: 'csv',
		});
		expect(result.ok).toBe(false);
		expect(result.data.paths).toEqual([]);
		expect(result.diagnostics).toEqual([
			{
				severity: 'error',
				code: 'parsing',
				message: 'Invalid CSV: quoted field is never closed (row 1, cell 1)',
			},
		]);
	});

	it('says nothing extra about a document that reads', async () => {
		const result = await call({
			content: 'name,path\napp,/etc/passwd\n',
			format: 'csv',
		});
		expect(result.ok).toBe(true);
		expect(result.diagnostics).toEqual([]);
		expect(result.meta.count).toBe(1);
	});
});

describe('protocol', () => {
	const respond = createResponder(
		{ name: 'paths-le', version: '1.0.0' },
		TOOLS,
	);

	it('echoes the protocol version the client asked for', async () => {
		const reply = await respond({
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: { protocolVersion: '2024-11-05' },
		});
		expect(reply?.result?.protocolVersion).toBe('2024-11-05');
		expect(reply?.result?.serverInfo).toEqual({
			name: 'paths-le',
			version: '1.0.0',
		});
	});

	it('does not reply to a notification', async () => {
		// A reply to a notification is the classic way to wedge a client.
		expect(
			await respond({ jsonrpc: '2.0', method: 'notifications/initialized' }),
		).toBeNull();
	});

	it('reports an unknown method as a JSON-RPC error', async () => {
		const reply = await respond({ jsonrpc: '2.0', id: 2, method: 'nope' });
		expect(reply?.error?.code).toBe(-32601);
	});

	it('reports an unknown tool without killing the connection', async () => {
		const reply = await respond({
			jsonrpc: '2.0',
			id: 3,
			method: 'tools/call',
			params: { name: 'no_such_tool', arguments: {} },
		});
		expect(reply?.error?.code).toBe(-32602);
	});

	it('returns a tool failure as a result, not a protocol error', async () => {
		// A model can read an isError result and correct itself; a JSON-RPC error
		// reads as "the server is broken". Missing `content` is the remaining
		// argument failure — an unnamed format is scanned rather than refused.
		const reply = await respond({
			jsonrpc: '2.0',
			id: 4,
			method: 'tools/call',
			params: { name: 'extract_paths', arguments: {} },
		});
		expect(reply?.error).toBeUndefined();
		expect(reply?.result?.isError).toBe(true);
	});
});

describe('serve: the stdio loop', () => {
	/** A fake stdin/stdout pair so the loop can be driven without a process. */
	function harness() {
		const input = new EventEmitter() as EventEmitter & {
			setEncoding?: (e: string) => void;
		};
		const written: string[] = [];
		const output = {
			write: (chunk: string) => {
				written.push(chunk);
				return true;
			},
		};
		serve(
			{ name: 'paths-le', version: '1.0.0' },
			TOOLS,
			input as never,
			output as never,
		);
		const replies = () =>
			written
				.join('')
				.split('\n')
				.filter(Boolean)
				.map((l) => JSON.parse(l));
		return { input, replies };
	}

	const settle = () => new Promise((r) => setTimeout(r, 20));

	it('answers a request delivered as one line', async () => {
		const { input, replies } = harness();
		input.emit('data', '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');
		await settle();
		expect(replies()[0]?.result?.tools).toHaveLength(1);
	});

	it('reassembles a request split across chunks', async () => {
		// stdin delivers whatever the OS gives it; a request arriving in two
		// pieces must not be dropped or double-parsed.
		const { input, replies } = harness();
		input.emit('data', '{"jsonrpc":"2.0","id":2,"me');
		input.emit('data', 'thod":"ping"}\n');
		await settle();
		expect(replies()[0]?.id).toBe(2);
	});

	it('handles several requests in one chunk', async () => {
		const { input, replies } = harness();
		input.emit(
			'data',
			'{"jsonrpc":"2.0","id":3,"method":"ping"}\n{"jsonrpc":"2.0","id":4,"method":"ping"}\n',
		);
		await settle();
		expect(replies().map((r) => r.id)).toEqual([3, 4]);
	});

	it('reports malformed JSON without dying', async () => {
		// One bad line from a client must not take the server down for everyone.
		const { input, replies } = harness();
		input.emit('data', 'not json at all\n');
		input.emit('data', '{"jsonrpc":"2.0","id":5,"method":"ping"}\n');
		await settle();
		expect(replies()[0]?.error?.code).toBe(-32700);
		expect(replies()[1]?.id).toBe(5);
	});

	it('rejects a payload that is not a JSON-RPC request', async () => {
		const { input, replies } = harness();
		input.emit('data', '{"hello":"world"}\n');
		await settle();
		expect(replies()[0]?.error?.code).toBe(-32700);
	});

	it('ignores blank lines', async () => {
		const { input, replies } = harness();
		input.emit('data', '\n\n{"jsonrpc":"2.0","id":6,"method":"ping"}\n');
		await settle();
		expect(replies()).toHaveLength(1);
	});

	it('writes nothing for a notification', async () => {
		const { input, replies } = harness();
		input.emit(
			'data',
			'{"jsonrpc":"2.0","method":"notifications/initialized"}\n',
		);
		await settle();
		expect(replies()).toHaveLength(0);
	});
});
