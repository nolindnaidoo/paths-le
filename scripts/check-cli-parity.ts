/**
 * Requires the npm command line to behave exactly as the Rust one does.
 *
 * Both install a command named `paths-le`, so a person or a CI step cannot
 * tell which one they have. This is a different contract from
 * `check-extraction-parity.ts`, which holds the extension's engine equal to
 * the crate's: here the whole terminal surface is compared, the walk, the
 * root, every verdict, the exit codes, stdout and stderr byte for byte, and
 * the two tools `paths-le mcp` serves.
 *
 * Every case runs both binaries over one generated tree with stdout piped,
 * which is how a script sees them. `--version` is compared too: every surface
 * carries one version, and two binaries of one name disagreeing about it is
 * the first thing a person comparing them would see.
 *
 * Run: bun run build:cli && cargo build --locked --manifest-path crate/Cargo.toml
 *      bun scripts/check-cli-parity.ts
 */
import { spawnSync } from 'node:child_process';
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmdirSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const RUST = process.env.PATHS_LE_BIN ?? join(ROOT, 'crate', 'target', 'debug', 'paths-le');
const NODE_CLI = join(ROOT, 'cli', 'cli.js');

interface Case {
	readonly args: readonly string[];
	readonly stdin?: string | Buffer;
}

interface Outcome {
	readonly status: number | null;
	readonly stdout: string;
	readonly stderr: string;
}

for (const [label, path] of [
	['the Rust binary', RUST],
	['cli/cli.js', NODE_CLI],
] as const) {
	if (!existsSync(path)) {
		console.error(`FAIL: ${label} is missing at ${path}. Build it first.`);
		process.exit(1);
	}
}

const tree = mkdtempSync(join(tmpdir(), 'paths-le-cli-parity-'));
const created: string[] = [];
const dirs: string[] = [tree];

function dir(relative: string): void {
	mkdirSync(join(tree, relative));
	dirs.push(join(tree, relative));
}

function file(relative: string, content: string | Buffer): void {
	writeFileSync(join(tree, relative), content);
	created.push(join(tree, relative));
}

function link(relative: string, target: string): void {
	symlinkSync(target, join(tree, relative));
	created.push(join(tree, relative));
}

const DATA = {
	up: '../../../../../../../../etc/hosts',
	abs: '/etc/hosts',
	missingAbs: '/definitely/not/here.txt',
	win: 'C:\\Temp\\x.txt',
	url: 'https://example.com/a.png',
	frag: '#section',
	ftp: 'ftp://host/file.txt',
	compose: '/etc/localtime:/etc/localtime:ro',
	mime: 'image/png',
	mixed: './util\\helper.ts/x',
	link: './linked.ts',
	broken: './dangling.ts',
	bare: 'docs/api',
	generated: './tool-facts.generated',
	dir: './util',
	trailing: './util/',
	double: './util//helper.ts',
	embedded: './util/../dedupe.ts',
	gone: './gone.json',
	escape: '../../../outside.json',
};

function build(): void {
	dir('repo');
	dir('repo/.git');
	dir('repo/.git/info');
	file('repo/.git/info/exclude', 'excluded.json\n');
	file('repo/.gitignore', 'ignored.json\nbuild/\n*.log\n!keep.log\n');
	file('repo/package.json', '{"main": "./src/index.ts", "types": "./dist/index.d.ts"}\n');
	dir('repo/src');
	file(
		'repo/src/index.ts',
		[
			"import a from './dedupe';",
			"import b from '../../outside/x.ts';",
			"import c from './util/helper.ts';",
			"import d from './gone.ts';",
			"import e from 'lodash';",
			"import f from './data.json';",
			"export const g = './util//helper.ts';",
			'',
		].join('\n'),
	);
	file('repo/src/dedupe.ts', 'export {};\n');
	file('repo/src/tool-facts.generated.ts', 'export {};\n');
	dir('repo/src/util');
	file('repo/src/util/helper.ts', 'export {};\n');
	file('repo/src/data.json', `${JSON.stringify(DATA, null, 2)}\n`);
	link('repo/src/linked.ts', 'util/helper.ts');
	link('repo/src/dangling.ts', 'nowhere.ts');
	file('repo/.env.local', 'SPACED=./my app/data.db\nOK=./src/index.ts\n');
	file('repo/.env', 'A=./src/gone.ts\n');
	file('repo/notes.md', 'See `src/gone.md` and src/index.ts and ./docs/missing.md\n');
	file('repo/script.py', 'open("data/missing.csv")\nimport os.path\n');
	file(
		'repo/ci.yml',
		'steps:\n  - uses: ./.github/actions/setup\n  - run: node ./scripts/build.js\nfiles: &shared ./src/index.ts\nagain: *shared\n',
	);
	file('repo/table.csv', 'name,path\na,./src/index.ts\nb,./gone.csv\n');
	file('repo/table.tsv', 'name\tpath\na\t./src/index.ts\n');
	file('repo/Cargo.toml', '[package]\nreadme = "README.md"\nbuild = "./build.rs"\n');
	file('repo/page.html', '<img src="./logo.png" srcset="a.png 1x, ./b.png 2x"><a href="#top">x</a>\n');
	file('repo/style.css', '.a{background:url("./logo.png")}\n.b{background:url(../gone.png)}\n');
	file('repo/bad.json', '{ "a": "./src/index.ts", \n');
	file('repo/bad.toml', 'a = \n');
	file('repo/bad.csv', 'a,"b\n');
	file('repo/logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x1a, 0x0a]));
	file('repo/latin1.json', Buffer.from([0x7b, 0x22, 0xe9, 0x22, 0x7d, 0x0a]));
	file('repo/bom.json', '\uFEFF{"a": "./src/index.ts"}\n');
	file('repo/empty.json', '');
	file('repo/ignored.json', '{"a": "./ignored-target.json"}\n');
	file('repo/excluded.json', '{"a": "./excluded-target.json"}\n');
	dir('repo/build');
	file('repo/build/out.json', '{"a": "./out-target.json"}\n');
	file('repo/noise.log', 'see ./noise/x.txt\n');
	file('repo/keep.log', 'see ./keep/x.txt\n');
	file('repo/.hidden.json', '{"a": "./hidden-target.json"}\n');
	dir('repo/.hiddendir');
	file('repo/.hiddendir/in.json', '{"a": "./in-target.json"}\n');
	dir('repo/nested');
	file('repo/nested/.gitignore', '!ignored.json\nlocal.json\n');
	file('repo/nested/ignored.json', '{"a": "../src/index.ts"}\n');
	file('repo/nested/local.json', '{"a": "./local-target.json"}\n');
	file('repo/nested/.ignore', 'dot-ignored.json\n');
	file('repo/nested/dot-ignored.json', '{"a": "./dot-target.json"}\n');
	dir('repo/packages');
	dir('repo/packages/app');
	file('repo/packages/app/a.json', '{"shared": "../../src/index.ts", "away": "../../../away.json"}\n');
	file('repo/ünïcode.json', '{"a": "./ünïcode-target.json"}\n');
	file('repo/dockerfile', 'COPY ./src/index.ts /app/index.ts\n');
	link('repo/linked-dir', 'src');

	dir('loose');
	file('loose/.gitignore', 'not-a-repo.json\n');
	file('loose/not-a-repo.json', '{"a": "./x.json"}\n');
	file('loose/.ignore', 'dot.json\n');
	file('loose/dot.json', '{"a": "./y.json"}\n');
	file('loose/a.json', '{"up": "../repo/src/index.ts", "here": "./not-a-repo.json"}\n');

	dir('follow');
	dir('follow/real');
	file('follow/real/a.json', '{"a": "../real/a.json", "b": "./gone.json"}\n');
	link('follow/via', 'real');
	link('follow/file.json', 'real/a.json');

	dir('loop');
	dir('loop/sub');
	file('loop/sub/a.json', '{"a": "./a.json"}\n');
	link('loop/sub/back', '..');

	dir('dead');
	file('dead/a.json', '{"a": "./a.json"}\n');
	link('dead/.gone.json', 'nowhere.json');

	file('stdin-target.json', '{}\n');

	if (process.platform !== 'win32' && process.getuid?.() !== 0) {
		file('repo/locked.json', '{"a": "./x.json"}\n');
		chmodSync(join(tree, 'repo', 'locked.json'), 0o000);
		dir('closed');
		dir('closed/shut');
		file('closed/a.json', '{}\n');
		chmodSync(join(tree, 'closed', 'shut'), 0o000);
	}
}

function cases(): readonly Case[] {
	const repo = join(tree, 'repo');
	const fixtures = join(ROOT, 'crate', 'fixtures');
	const at = (relative: string): string => join(repo, relative);
	const json = '{"a": "./stdin-target.json", "b": "./gone.json", "c": "../x.json"}\n';
	return [
		{ args: ['--help'] },
		{ args: ['--version'] },
		{ args: ['-V'] },
		{ args: ['-h'] },
		{ args: [] },
		{ args: [repo] },
		{ args: [`${repo}/`] },
		{ args: ['repo'] },
		{ args: ['./repo/src/'] },
		{ args: [repo, '--no-resolve'] },
		{ args: [repo, '--resolve'] },
		{ args: [repo, '--deny-symlinks'] },
		{ args: [repo, '--resolve', '--deny-symlinks', '--strict'] },
		{ args: [repo, '--strict'] },
		{ args: [repo, '--hidden'] },
		{ args: [repo, '--no-ignore'] },
		{ args: [repo, '--hidden', '--no-ignore'] },
		{ args: [repo, '--follow-symlinks'] },
		{ args: [repo, '--format', 'json'] },
		{ args: [repo, '--format', 'YML'] },
		{ args: [repo, '--format', '.md'] },
		{ args: [repo, '--format', 'python'] },
		{ args: [repo, '--format'] },
		{ args: [repo, '--root', at('src')] },
		{ args: [repo, '--root', 'repo'] },
		{ args: [repo, '--root', tree] },
		{ args: [repo, '--root', at('package.json')] },
		{ args: [repo, '--root', join(tree, 'missing')] },
		{ args: [repo, '--root'] },
		{ args: [at('src/data.json')] },
		{ args: ['repo/src/data.json'] },
		{ args: [at('src/index.ts'), '--deny-symlinks'] },
		{ args: [at('.env.local'), at('.env')] },
		{ args: [at('notes.md'), at('script.py'), at('dockerfile')] },
		{ args: [at('notes.md'), at('script.py'), at('dockerfile'), '--resolve'] },
		{ args: [at('ci.yml'), at('table.csv'), at('table.tsv'), at('Cargo.toml')] },
		{ args: [at('page.html'), at('style.css')] },
		{ args: [at('ignored.json'), at('.hidden.json'), at('package.json')] },
		{ args: [at('package.json'), at('package.json')] },
		{ args: [at('src/dedupe.ts'), at('src')] },
		{ args: [at('logo.png')] },
		{ args: [at('latin1.json'), '--strict'] },
		{ args: [at('latin1.json')] },
		{ args: [at('bad.json')] },
		{ args: [at('bad.toml'), at('bad.csv')] },
		{ args: [at('bom.json')] },
		{ args: [at('empty.json')] },
		{ args: [at('nested')] },
		{ args: [at('packages/app')] },
		{ args: [at('packages/app'), '--root', at('packages/app')] },
		{ args: [at('linked-dir')] },
		{ args: [join(tree, 'loose')] },
		{ args: [join(tree, 'loose', 'a.json')] },
		{ args: [join(tree, 'follow')] },
		{ args: [join(tree, 'follow'), '--follow-symlinks'] },
		{ args: [join(tree, 'follow'), '--follow-symlinks', '--deny-symlinks'] },
		{ args: [join(tree, 'follow', 'file.json')] },
		{ args: [join(tree, 'loop')] },
		{ args: [join(tree, 'loop'), '--follow-symlinks'] },
		{ args: [join(tree, 'loop', 'sub'), '--follow-symlinks'] },
		{ args: [join(tree, 'dead')] },
		{ args: [join(tree, 'dead'), '--follow-symlinks'] },
		{ args: [join(tree, 'closed')] },
		{ args: [join(tree, 'missing')] },
		{ args: [repo, '--stict'] },
		{ args: [repo, '--help'] },
		{ args: [repo, '-'] },
		{ args: [repo, join(tree, 'loose')] },
		{ args: ['--stdin'] },
		{ args: ['--stdin', repo] },
		{ args: ['--stdin', '--format', 'json'], stdin: json },
		{ args: ['--stdin', '--format', 'json', '--no-resolve'], stdin: json },
		{ args: ['--stdin', '--format', 'json', '--root', repo], stdin: json },
		{ args: ['--stdin', '--format', 'json'], stdin: `\uFEFF${json}` },
		{ args: ['--stdin', '--format', 'json'], stdin: Buffer.from([0x7b, 0xff, 0x7d]) },
		{ args: ['--stdin', '--format', 'markdown'], stdin: 'see ./gone.md\n' },
		{ args: ['--stdin', '--format', 'markdown', '--resolve'], stdin: 'see ./gone.md\n' },
		{ args: ['--stdin', '--format', 'json'], stdin: '' },
		{ args: ['--stdin', '--format', 'json'], stdin: '{ broken' },
		{ args: [fixtures] },
		{ args: [fixtures, '--no-ignore', '--hidden', '--resolve'] },
		{ args: [join(ROOT, 'src', 'extraction', '__fixtures__')] },
	];
}

function runOne(command: readonly string[], testCase: Case): Outcome {
	const [program, ...rest] = command as [string, ...string[]];
	const result = spawnSync(program, [...rest, ...testCase.args], {
		input: testCase.stdin ?? '',
		cwd: tree,
	});
	return {
		status: result.status,
		stdout: result.stdout.toString('utf8'),
		stderr: result.stderr.toString('utf8'),
	};
}

function compareCli(): string[] {
	const failures: string[] = [];
	for (const testCase of cases()) {
		const rust = runOne([RUST], testCase);
		const node = runOne([process.execPath, NODE_CLI], testCase);
		for (const field of ['status', 'stdout', 'stderr'] as const) {
			if (rust[field] === node[field]) continue;
			failures.push(
				`paths-le ${testCase.args.join(' ')}\n  ${field} differs\n` +
					`  rust: ${JSON.stringify(rust[field])}\n  node: ${JSON.stringify(node[field])}`,
			);
		}
	}
	return failures;
}

/** Key order is not compared: the crate's JSON values are sorted maps. */
function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (typeof value !== 'object' || value === null) return value;
	return Object.fromEntries(
		Object.keys(value)
			.sort()
			.map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
	);
}

/** Tool results with the text half parsed, so pretty-printing order cannot differ. */
function comparable(response: Record<string, unknown>): unknown {
	const result = response.result as Record<string, unknown> | undefined;
	const content = result?.content as { type: string; text: string }[] | undefined;
	if (!content || result?.isError === true) return canonical(response);
	const parsed = content.map((item) => ({ ...item, text: JSON.parse(item.text) }));
	return canonical({ ...response, result: { ...result, content: parsed } });
}

function mcpRequests(): readonly Record<string, unknown>[] {
	const repo = join(tree, 'repo');
	const call = (id: number, name: string, args: Record<string, unknown>) => ({
		jsonrpc: '2.0',
		id,
		method: 'tools/call',
		params: { name, arguments: args },
	});
	return [
		call(1, 'paths_le_audit', { path: repo }),
		call(2, 'paths_le_audit', { paths: [repo, join(tree, 'loose')], resolve: false }),
		call(3, 'paths_le_audit', {
			path: repo,
			resolveScanned: true,
			denySymlinks: true,
			root: join(repo, 'src'),
		}),
		call(4, 'paths_le_audit', { path: join(repo, 'src', 'data.json'), resolve: 'yes' }),
		call(5, 'paths_le_audit', { paths: [] }),
		call(6, 'paths_le_audit', {}),
		call(7, 'paths_le_audit', { path: join(tree, 'missing') }),
		call(8, 'paths_le_audit', { path: repo, root: join(repo, 'package.json') }),
		call(9, 'paths_le_audit', { path: join(repo, 'packages', 'app') }),
		call(10, 'extract_paths', { content: '{"a": "./b.json"}', format: 'json' }),
		call(11, 'extract_paths', { content: 'LOG_DIR=./my logs/app.log\n', filename: '.env.local' }),
		call(12, 'extract_paths', { content: 'const a = "./b.ts";\n', filename: 'env.ts' }),
	];
}

function serve(command: readonly string[], requests: readonly unknown[]): unknown[] {
	const [program, ...rest] = command as [string, ...string[]];
	const input = `${requests.map((request) => JSON.stringify(request)).join('\n')}\n`;
	const result = spawnSync(program, [...rest, 'mcp'], { input, encoding: 'utf8', cwd: tree });
	return result.stdout
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}

function compareMcp(): string[] {
	const failures: string[] = [];
	const list = { jsonrpc: '2.0', id: 0, method: 'tools/list', params: {} };
	const requests = [list, ...mcpRequests()];
	const rust = serve([RUST], requests) as Record<string, unknown>[];
	const node = serve([process.execPath, NODE_CLI], requests) as Record<string, unknown>[];
	// By id, not by line: the npm server answers each call as it finishes,
	// which JSON-RPC allows, so its replies need not arrive in request order.
	const byId = (replies: Record<string, unknown>[], id: unknown) =>
		replies.find((reply) => reply.id === id) ?? {};
	requests.forEach((request) => {
		const left = JSON.stringify(comparable(byId(rust, request.id)));
		const right = JSON.stringify(comparable(byId(node, request.id)));
		if (left === right) return;
		failures.push(
			`paths-le mcp ${JSON.stringify((request as { params: unknown }).params)}\n` +
				`  rust: ${left}\n  node: ${right}`,
		);
	});
	return failures;
}

function cleanUp(): void {
	const locked = join(tree, 'repo', 'locked.json');
	if (existsSync(locked)) chmodSync(locked, 0o600);
	const shut = join(tree, 'closed', 'shut');
	if (existsSync(shut)) chmodSync(shut, 0o700);
	for (const path of created) unlinkSync(path);
	for (const path of [...dirs].reverse()) rmdirSync(path);
}

build();
let failures: string[];
try {
	failures = [...compareCli(), ...compareMcp()];
} finally {
	cleanUp();
}

if (failures.length > 0) {
	console.error(failures.join('\n\n'));
	console.error(`\nFAIL: ${failures.length} difference(s) between the npm and Rust CLIs`);
	process.exit(1);
}
console.log(`OK: the npm CLI matches the Rust CLI on ${cases().length} commands and the MCP surface`);
