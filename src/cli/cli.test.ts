import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmdirSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from './args';
import { auditContent, exitCode, type FileReport } from './audit';
import { AUDIT_TOOL } from './auditTool';
import { rustIoMessage } from './ioError';
import { serve } from './mcp';
import { isFinding, resolvePath } from './resolve';
import { chooseRoot } from './root';
import { run } from './run';
import {
	components,
	forwardSlashes,
	joinNormalised,
	parentDir,
	relativeTo,
	render,
} from './rustPath';
import { FLAGS, USAGE } from './usage';
import { collect, DEFAULT_WALK } from './walk';

const POSIX = sep === '/';
const LINKS = process.platform !== 'win32';

describe('usage', () => {
	it('names every flag the parser accepts, and no other', () => {
		const named = new Set(
			USAGE.split(/\s+/)
				.filter((word) => word.startsWith('--'))
				.map((word) => word.replace(/[,.:;)]+$/, ''))
				.filter((word) => word !== '--version' && word !== '--help'),
		);
		expect([...named].sort()).toEqual([...FLAGS].sort());
	});

	it('names the exit codes it returns', () => {
		for (const code of ['0 clear', '1 findings', '2 malformed'])
			expect(USAGE).toContain(code);
	});
});

describe('parse', () => {
	it('refuses an unknown flag rather than ignoring it', () => {
		expect(() => parse(['--stict', 'x'])).toThrow('--stict is not an option');
	});

	it('accepts every flag it lists', () => {
		for (const flag of FLAGS) {
			const args =
				flag === '--root' || flag === '--format'
					? [flag, 'json', 'x']
					: flag === '--stdin'
						? [flag]
						: [flag, 'x'];
			expect(() => parse(args), flag).not.toThrow();
		}
	});

	it('refuses a flag with no value', () => {
		expect(() => parse(['--root'])).toThrow('--root needs a directory');
		expect(() => parse(['--format'])).toThrow('--format needs a format');
	});

	it('scans an unknown format rather than refusing it', () => {
		expect(parse(['--format', 'python', 'x']).format).toBe('unknown');
		expect(parse(['--format', 'YML', 'x']).walk.format).toBe('yaml');
	});

	it('refuses naming nothing, and stdin with files', () => {
		expect(() => parse([])).toThrow('name a file or a directory to audit');
		expect(() => parse(['--stdin', 'x'])).toThrow('takes no file arguments');
	});

	it('resolves by default, and a generic scan only when asked', () => {
		const plain = parse(['x']);
		expect([plain.resolve, plain.resolveScanned]).toEqual([true, false]);
		const asked = parse(['--resolve', 'x']);
		expect([asked.resolve, asked.resolveScanned]).toEqual([true, true]);
		expect(parse(['--no-resolve', 'x']).resolve).toBe(false);
	});
});

describe.runIf(POSIX)('rustPath', () => {
	it('splits as Rust does, keeping `.` only at the start', () => {
		expect(components('./a/./b//c/')).toEqual(['.', 'a', 'b', 'c']);
		expect(components('/a')).toEqual(['', 'a']);
		expect(render(components('/a/b'))).toBe('/a/b');
	});

	it('cannot climb above the root, and joins an absolute value as itself', () => {
		expect(render(joinNormalised('/a', '../../../x'))).toBe('/x');
		expect(render(joinNormalised('/a/b', '/etc/./hosts'))).toBe('/etc/hosts');
	});

	it('spells a path from the root, climbing where it lands outside', () => {
		expect(render(relativeTo(['', 'r', 'a'], ['', 'r']) ?? [])).toBe('a');
		expect(render(relativeTo(['', 'x'], ['', 'r', 's']) ?? [])).toBe('../../x');
		expect(render(relativeTo(['', 'r'], ['', 'r']) ?? [])).toBe('.');
	});

	it('gives a bare filename the working directory as its parent', () => {
		expect(parentDir('a.json')).toBe('.');
		expect(parentDir('./a.json')).toBe('.');
		expect(parentDir('/a.json')).toBe('/');
		expect(parentDir('dir/a.json')).toBe('dir');
	});
});

describe('forwardSlashes', () => {
	it('drops the verbatim prefix and keeps a UNC host', () => {
		expect(forwardSlashes('\\\\?\\C:\\repo\\a')).toBe('C:/repo/a');
		expect(forwardSlashes('\\\\?\\UNC\\server\\share')).toBe('//server/share');
	});
});

describe('isFinding', () => {
	it('counts a symlink only when asked', () => {
		expect(isFinding('symlinked', false)).toBe(false);
		expect(isFinding('symlinked', true)).toBe(true);
		expect(isFinding('non-canonical', false)).toBe(true);
		expect(isFinding('unresolved', true)).toBe(false);
	});
});

describe('ioError', () => {
	it('speaks as Rust does about a missing file', () => {
		const error = Object.assign(new Error('ENOENT: no such file'), {
			code: 'ENOENT',
			errno: -2,
		});
		expect(rustIoMessage(error, 'darwin')).toBe(
			'No such file or directory (os error 2)',
		);
	});

	const failure = (code: string, errno: number, path?: string) =>
		Object.assign(new Error(`${code}: failed`), { code, errno, path });

	it('speaks as Rust does on Linux and Windows too', () => {
		expect(rustIoMessage(failure('EBUSY', -16), 'darwin')).toBe(
			'Resource busy (os error 16)',
		);
		expect(rustIoMessage(failure('EBUSY', -16), 'linux')).toBe(
			'Device or resource busy (os error 16)',
		);
		expect(rustIoMessage(failure('EPERM', -4048), 'win32')).toBe(
			'Access is denied. (os error 5)',
		);
	});

	/** libuv folds both Windows codes into ENOENT, numbered -4058. */
	it('tells a missing file from a missing directory on Windows', () => {
		const root = mkdtempSync(join(tmpdir(), 'io-error-'));
		writeFileSync(join(root, 'file'), '');
		const missing = (...parts: string[]) =>
			rustIoMessage(failure('ENOENT', -4058, join(root, ...parts)), 'win32');
		try {
			expect(missing('gone')).toBe(
				'The system cannot find the file specified. (os error 2)',
			);
			expect(missing('no', 'gone')).toBe(
				'The system cannot find the path specified. (os error 3)',
			);
			expect(missing('file', 'gone')).toBe(
				'The system cannot find the path specified. (os error 3)',
			);
		} finally {
			unlinkSync(join(root, 'file'));
			rmdirSync(root);
		}
	});
});

describe('on a real tree', () => {
	const made: string[] = [];
	const dirs: string[] = [];

	function tree(files: Record<string, string>): string {
		const root = mkdtempSync(join(tmpdir(), 'paths-le-cli-test-'));
		dirs.push(root);
		for (const [name, content] of Object.entries(files)) {
			const parts = name.split('/');
			for (let depth = 1; depth < parts.length; depth++) {
				const dir = join(root, ...parts.slice(0, depth));
				if (dirs.includes(dir)) continue;
				mkdirSync(dir);
				dirs.push(dir);
			}
			writeFileSync(join(root, name), content);
			made.push(join(root, name));
		}
		return realpathSync.native(root);
	}

	function link(target: string, at: string): void {
		symlinkSync(target, at);
		made.push(at);
	}

	afterEach(() => {
		for (const file of made.splice(0)) unlinkSync(file);
		for (const dir of dirs.splice(0).reverse()) rmdirSync(dir);
	});

	function verdicts(report: FileReport): string[] {
		return report.paths.map(
			(path) => `${path.value}:${path.resolution.verdict}`,
		);
	}

	const options = (root: string) => ({
		resolve: true,
		resolveScanned: false,
		root,
		denySymlinks: false,
	});

	it('gives each kind of path its verdict', () => {
		const root = tree({
			'src/dedupe.ts': '',
			'src/util/helper.ts': '',
			'src/a.json': '',
		});
		const report = auditContent(
			'{"probe": "./dedupe", "ok": "./util/helper.ts", "gone": "./gone.ts", "up": "../../x.ts", "double": "./util//helper.ts", "bare": "docs/api"}',
			{ path: join(root, 'src', 'a.json'), languageId: 'json' },
			options(root),
		);
		expect(verdicts(report)).toEqual([
			'./dedupe:ok',
			'./util/helper.ts:ok',
			'./gone.ts:missing',
			'../../x.ts:escapes-root',
			'./util//helper.ts:non-canonical',
			'docs/api:unresolved',
		]);
		expect(report.paths[0]?.resolution.reason).toBe(
			'written without an extension; resolved to dedupe.ts',
		);
		expect(report.paths[2]?.resolution.canonical).toBe('src/gone.ts');
		expect(exitCode([report], false)).toBe(1);
	});

	it('reports a generic scan as written unless resolution is asked for', () => {
		const root = tree({ 'notes.md': '' });
		const target = { path: join(root, 'notes.md'), languageId: 'markdown' };
		const declined = auditContent('see ./gone.md', target, options(root));
		expect(declined.paths[0]?.resolution.verdict).toBe('unresolved');
		expect(exitCode([declined], false)).toBe(0);
		const asked = auditContent('see ./gone.md', target, {
			...options(root),
			resolveScanned: true,
		});
		expect(asked.paths[0]?.resolution.verdict).toBe('missing');
	});

	it('fails the run on a document that does not parse', () => {
		const root = tree({});
		const report = auditContent(
			'{ broken',
			{ path: join(root, 'a.json'), languageId: 'json' },
			options(root),
		);
		expect(report.diagnostics[0]?.severity).toBe('error');
		expect(exitCode([report], false)).toBe(2);
	});

	it.runIf(LINKS)('names a link and its target, and a broken one', () => {
		const root = tree({ 'real.ts': '' });
		link('real.ts', join(root, 'via.ts'));
		link('nowhere.ts', join(root, 'dead.ts'));
		const via = resolvePath('./via.ts', 'relative', root, root);
		expect(via).toEqual({
			verdict: 'symlinked',
			canonical: 'real.ts',
			symlink: 'real.ts',
			reason: null,
		});
		const dead = resolvePath('./dead.ts', 'relative', root, root);
		expect([dead.verdict, dead.reason]).toEqual([
			'missing',
			'a broken symlink',
		]);
	});

	it('roots at the enclosing repository, even given one package', () => {
		const root = tree({
			'.git': 'gitdir: elsewhere\n',
			'packages/app/a.json': '{}',
		});
		const app = join(root, 'packages', 'app');
		expect(chooseRoot(null, [app], root)).toBe(root);
		expect(chooseRoot(null, [join(app, 'a.json')], root)).toBe(root);
		expect(chooseRoot(app, [app], root)).toBe(realpathSync.native(app));
		expect(() => chooseRoot(join(app, 'a.json'), [], root)).toThrow(
			'is not a directory',
		);
	});

	it('sorts by component, as Rust sorts a path', () => {
		const root = tree({ 'a.json': '', 'a/b.json': '', 'z.json': '' });
		const walked = collect([root], DEFAULT_WALK).map((target) =>
			target.path.slice(root.length + 1),
		);
		expect(walked).toEqual([join('a', 'b.json'), 'a.json', 'z.json']);
	});

	it.runIf(LINKS)('reports a link without descending it unless asked', () => {
		const root = tree({ 'real/a.json': '{}' });
		link('real', join(root, 'via'));
		expect(collect([root], DEFAULT_WALK)).toHaveLength(1);
		const followed = { ...DEFAULT_WALK, followSymlinks: true };
		expect(collect([root], followed)).toHaveLength(2);
	});

	it.runIf(LINKS)('refuses a loop when following links', () => {
		const root = tree({ 'sub/a.json': '{}' });
		link('..', join(root, 'sub', 'back'));
		expect(() =>
			collect([root], { ...DEFAULT_WALK, followSymlinks: true }),
		).toThrow('File system loop found');
	});

	it('writes JSON Lines to a pipe and names the root once', async () => {
		const root = tree({ '.git': '', 'a.json': '{"a": "./gone.json"}' });
		let out = '';
		let err = '';
		const code = await run([join(root, 'a.json')], {
			stdout: (text) => {
				out += text;
			},
			stderr: (text) => {
				err += text;
			},
			stdoutIsTerminal: false,
			readStdin: async () => new Uint8Array(),
			cwd: root,
			version: '0.0.0',
		});
		expect(code).toBe(1);
		expect(JSON.parse(out).paths[0].resolution.verdict).toBe('missing');
		expect(
			err.endsWith(
				`1 path in 1 file — 1 finding (root ${root.replaceAll('\\', '/')})\n`,
			),
		).toBe(true);
	});

	it('refuses stdin without a format before reading it, with exit 2', async () => {
		let err = '';
		const code = await run(['--stdin'], {
			stdout: () => {},
			stderr: (text) => {
				err += text;
			},
			stdoutIsTerminal: true,
			readStdin: async () => {
				throw new Error('stdin was read');
			},
			cwd: tmpdir(),
			version: '0.0.0',
		});
		expect(code).toBe(2);
		expect(err).toBe(
			'paths-le: reading from stdin needs --format: the name that would carry the format is not there\n',
		);
	});

	it('answers the audit tool with findings as a result, not an error', async () => {
		const root = tree({ '.git': '', 'a.json': '{"a": "./gone.json"}' });
		const result = (await AUDIT_TOOL.handler({ path: root })) as {
			ok: boolean;
			data: { findings: number };
		};
		expect(result.ok).toBe(true);
		expect(result.data.findings).toBe(1);
		await expect(AUDIT_TOOL.handler({ paths: [] })).rejects.toThrow(
			'the list of paths was empty',
		);
	});
});

describe('mcp: the crate framing', () => {
	// The protocol around the tools answers as the extension's server and
	// the crate's answer, so a client cannot tell the three apart by what it
	// sent. Replies are parsed: key order is the crate's concern, not this one.
	async function session(
		lines: readonly (string | Uint8Array)[],
	): Promise<{ status: number; replies: unknown[] }> {
		const written: string[] = [];
		const input = Readable.from(lines.map((item) => Buffer.from(item)));
		const status = await serve(
			input,
			(line) => {
				written.push(line);
				return undefined;
			},
			{ name: 'paths-le', version: '9.9.9' },
			[],
		);
		return { status, replies: written.map((line) => JSON.parse(line)) };
	}

	it("answers a malformed frame in the extension server's words and serves the next line", async () => {
		// A frame that is not JSON, or not UTF-8, was dropped without a word,
		// and a client lost every request it then waited on.
		const { status, replies } = await session([
			'{"jsonrpc":"2.0","id":1,"method":"initialize"}\n',
			'{"jsonrpc":"2.0","method":"notifications/initialized"}\n',
			'not json\n',
			Uint8Array.from([0x7b, 0xff, 0x7d, 0x0a]),
			'   \n',
			'{"jsonrpc":"2.0","id":2,"method":"nope"}\n',
		]);
		expect(status).toBe(0);
		expect(replies).toEqual([
			{
				jsonrpc: '2.0',
				id: 1,
				result: {
					protocolVersion: '2025-06-18',
					capabilities: { tools: {} },
					serverInfo: { name: 'paths-le', version: '9.9.9' },
				},
			},
			{
				jsonrpc: '2.0',
				id: null,
				error: { code: -32700, message: 'Invalid JSON' },
			},
			{
				jsonrpc: '2.0',
				id: null,
				error: { code: -32700, message: 'Invalid JSON' },
			},
			{
				jsonrpc: '2.0',
				id: 2,
				error: { code: -32601, message: 'Unknown method: nope' },
			},
		]);
	});

	it('refuses malformed frames in the words the other two servers use, and a null id is a notification', async () => {
		const { replies } = await session([
			'{"id":1,"method":"ping"}\n',
			'{"jsonrpc":"1.0","id":2,"method":"ping"}\n',
			'[{"jsonrpc":"2.0","id":3,"method":"ping"}]\n',
			'{"jsonrpc":"2.0","id":null,"method":"ping"}\n',
			'{"jsonrpc":"2.0","id":4,"method":"notifications/initialized"}\n',
			'{"jsonrpc":"2.0","id":5,"method":"tools/call","params":5}\n',
			'{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"nope"}}\n',
			'{"jsonrpc":"2.0","id":7,"method":"tools/call"}\n',
			'{"jsonrpc":"2.0","id":8,"method":"initialize","params":{"protocolVersion":"1999-01-01"}}\n',
		]);
		const refused = {
			jsonrpc: '2.0',
			id: null,
			error: { code: -32700, message: 'Not a JSON-RPC 2.0 request' },
		};
		expect(replies).toEqual([
			refused,
			refused,
			refused,
			{
				jsonrpc: '2.0',
				id: 4,
				error: {
					code: -32601,
					message: 'Unknown method: notifications/initialized',
				},
			},
			{
				jsonrpc: '2.0',
				id: 5,
				error: { code: -32602, message: 'tools/call requires a string `name`' },
			},
			{
				jsonrpc: '2.0',
				id: 6,
				error: { code: -32602, message: 'Unknown tool: nope' },
			},
			{
				jsonrpc: '2.0',
				id: 7,
				error: { code: -32602, message: 'tools/call requires a string `name`' },
			},
			{
				jsonrpc: '2.0',
				id: 8,
				result: {
					capabilities: { tools: {} },
					protocolVersion: '2025-06-18',
					serverInfo: { name: 'paths-le', version: '9.9.9' },
				},
			},
		]);
	});

	it('waits for the pipe to drain before reading the next frame', async () => {
		const lines: string[] = [];
		let drained = 0;
		const input = Readable.from([
			Buffer.from(
				'{"jsonrpc":"2.0","id":1,"method":"ping"}\n{"jsonrpc":"2.0","id":2,"method":"ping"}\n',
			),
		]);
		const write = (line: string) => {
			lines.push(line);
			return new Promise<void>((resolve) =>
				setTimeout(() => {
					drained += 1;
					resolve();
				}, 1),
			);
		};
		await serve(input, write, { name: 'paths-le', version: '9.9.9' }, []);
		expect(lines).toHaveLength(2);
		expect(drained).toBe(2);
	});
});
