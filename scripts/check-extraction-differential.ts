/**
 * Generates the cases the hand-written corpus cannot contain: the ones
 * nobody thought of.
 *
 * **Scope: the shared `extract_paths` tool, and nothing else.** One tool
 * name, one schema, two servers — the npm one the extension ships and
 * the Rust one in `crate/`. An agent asking that tool must get the same
 * answer whichever server it happens to reach, so a divergence here is a
 * defect by definition.
 *
 * The two *surfaces* are a different matter and are deliberately not
 * compared. The extension is IDE-first — one open buffer, a person
 * reading results in an editor — and the CLI is terminal-first: trees,
 * exit codes, JSON Lines, `--strict`. Holding either to the other's
 * shape would be the wrong check. `crate/SPEC.md` records the
 * divergences that follow from that split.
 *
 * `crate/fixtures/mcp-extract-paths.json` pins what somebody sat down
 * and wrote. This combines a format, a value, a wrapper and an argument
 * shape into several hundred calls and puts every one of them through
 * both servers. It is the check that catches a language id mapping to
 * two different extractors, which a fixed corpus cannot, because a fixed
 * corpus only holds the mappings somebody remembered to write down.
 *
 * Deterministic: the seed is printed on every run and on every failure,
 * and re-running with `--seed <n>` reproduces the exact call set.
 *
 * Run: bun scripts/check-extraction-differential.ts [--seed <n>] [--count <n>]
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TOOLS } from '../src/mcp/tools';

const ROOT = join(import.meta.dir, '..');

function argument(name: string, fallback: number): number {
	const at = process.argv.indexOf(`--${name}`);
	if (at === -1) return fallback;
	const value = Number(process.argv[at + 1]);
	if (!Number.isFinite(value)) {
		console.error(`--${name} needs a number`);
		process.exit(2);
	}
	return value;
}

/** Fixed in CI so a red build is reproducible from the log alone. */
const SEED = argument('seed', 0x5ea1_0000);
/** At least 500, per the CI hardening spec. */
const COUNT = argument('count', 560);

/** mulberry32: small, seeded, and identical on every machine. */
function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b_79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/**
 * Values a path extractor might reasonably meet, including the ones the
 * heuristic is supposed to REJECT — a version string, an attribute
 * access, a glob. A generator that only produced real paths would never
 * exercise the half of the heuristic that says no.
 */
const VALUES = [
	'./utils/helper.ts',
	'../config/app.config.js',
	'/var/log/app.log',
	'C:\\Temp\\cache\\file.txt',
	'C:/Temp/cache/file.txt',
	'https://cdn.example.com/lib.js',
	'file:///opt/data/blob.bin',
	'docs/architecture.md',
	'README.md',
	'example.com',
	'1.8.1',
	'192.168.1.1',
	'src/**/*.ts',
	'//host/share/a.txt',
	'#anchor',
	'/\u6587\u66f8/\u5831\u544a.md',
	'./\u{1f3af}/target.ts',
	'./dir with space/x.md',
	'a//b/../c.txt',
	'data:image/png;base64,AAAA',
	'os.path',
	'./no-extension',
	'./a.ts:12',
	'/etc/localtime:/etc/localtime:ro',
	'@org/package',
	'node:fs',
	'.',
	'./',
	'\u00e9caf\u00e9/na\u00efve.txt',
	// The whitespace sets the two languages genuinely disagree about:
	// U+FEFF is whitespace to JavaScript and not to Unicode, U+0085 is
	// the mirror image, and U+2028/U+2029 are line terminators to one
	// only. Both engines are spelled to match by hand; this is what
	// checks the spelling on values nobody wrote down.
	'na\ufeffme.txt',
	'dir/\ufefffile.txt',
	'na\u0085me.txt',
	'\u0085/a.txt',
	'a\u2028/b.txt',
	'a\u2029/b.txt',
	'a\u00a0/b.txt',
	'a\tb/c.txt',
	'./\u{10fffd}/x.ts',
	'',
	'  ',
	`./${'deep/'.repeat(40)}leaf.txt`,
] as const;

type Wrapper = {
	readonly name: string;
	/** Whether this value can be embedded this way without changing it. */
	readonly safe?: (value: string) => boolean;
	readonly build: (value: string) => string;
};

type Format = {
	/** The language id both servers resolve to. */
	readonly languageId: string;
	/** Names a caller might send instead, each of which must resolve here. */
	readonly aliases: readonly string[];
	readonly extension: string;
	readonly wrappers: readonly Wrapper[];
};

const json = (value: string) => JSON.stringify(value);
/** A TOML literal string keeps backslashes; every value here is quotable. */
const tomlLiteral = (value: string) => `'${value}'`;
const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
const noQuote = (value: string) => !value.includes("'") && !value.includes('"');
const oneLine = (value: string) => !value.includes('\n');

const FORMATS: readonly Format[] = [
	{
		languageId: 'json',
		aliases: ['json', 'jsonc', '.JSON'],
		extension: 'json',
		wrappers: [
			{ name: 'quoted', build: (v) => `{"a": ${json(v)}}\n` },
			{ name: 'mid-line', build: (v) => `{"x": 1, "a": ${json(v)}, "y": 2}\n` },
			{ name: 'nested', build: (v) => `{"o": {"list": [${json(v)}]}}\n` },
			{ name: 'key', build: (v) => `{${json(v)}: "x"}\n` },
			{ name: 'comment', build: (v) => `{\n  // ${v}\n  "a": ${json(v)}\n}\n` },
			{ name: 'eof-no-newline', build: (v) => `{"a": ${json(v)}}` },
		],
	},
	{
		languageId: 'yaml',
		aliases: ['yaml', 'yml'],
		extension: 'yml',
		wrappers: [
			{ name: 'quoted', build: (v) => `a: ${json(v)}\n` },
			{ name: 'key', build: (v) => `${json(v)}: x\n` },
			{ name: 'sequence', build: (v) => `list:\n  - ${json(v)}\n  - other\n` },
			{ name: 'comment', build: (v) => `# ${v}\na: ${json(v)}\n` },
			{ name: 'anchor', build: (v) => `base: &b ${json(v)}\nalias: *b\n` },
			{ name: 'eof-no-newline', build: (v) => `a: ${json(v)}` },
		],
	},
	{
		languageId: 'toml',
		aliases: ['toml', '.toml'],
		extension: 'toml',
		wrappers: [
			{ name: 'quoted', safe: noQuote, build: (v) => `a = ${tomlLiteral(v)}\n` },
			{
				name: 'table',
				safe: noQuote,
				build: (v) => `[t]\na = ${tomlLiteral(v)}\n`,
			},
			{
				name: 'array',
				safe: noQuote,
				build: (v) => `a = [${tomlLiteral(v)}, 'x']\n`,
			},
			{
				name: 'comment',
				safe: noQuote,
				build: (v) => `# ${v}\na = ${tomlLiteral(v)}\n`,
			},
			{
				name: 'eof-no-newline',
				safe: noQuote,
				build: (v) => `a = ${tomlLiteral(v)}`,
			},
		],
	},
	{
		languageId: 'csv',
		aliases: ['csv', 'tsv'],
		extension: 'csv',
		wrappers: [
			{ name: 'quoted', build: (v) => `one,two\n${csvCell(v)},2\n` },
			{ name: 'mid-line', build: (v) => `a,b,c\n1,${csvCell(v)},3\n` },
			{ name: 'header', build: (v) => `${csvCell(v)},two\n1,2\n` },
			{ name: 'eof-no-newline', build: (v) => `one,two\n${csvCell(v)},2` },
			// The refusals. Both servers have to agree on the *message* here,
			// not just on the absence of paths: a document that comes back
			// empty from one and named from the other is the silent miss this
			// tool exists to prevent, one server at a time. Every wrapper
			// above is well-formed, so nothing generated ever reached this
			// half of the reader.
			{ name: 'mis-quoted', build: (v) => `${csvCell(v)}x,two\n1,2\n` },
			{
				name: 'unterminated',
				safe: noQuote,
				build: (v) => `"${v},two\n1,2\n`,
			},
			// A closing quote followed by a space that is not one byte wide —
			// which `csv-parse` refused and neither reader does.
			{
				name: 'multi-byte-space',
				build: (v) => `${csvCell(v)}\u{a0},two\n1,2\n`,
			},
		],
	},
	{
		languageId: 'dotenv',
		aliases: ['dotenv', 'env', '.env'],
		extension: 'env',
		wrappers: [
			{ name: 'bare', safe: oneLine, build: (v) => `A=${v}\n` },
			{ name: 'quoted', safe: noQuote, build: (v) => `A="${v}"\n` },
			{ name: 'comment', safe: oneLine, build: (v) => `# ${v}\nA=x\n` },
			{ name: 'key', safe: oneLine, build: (v) => `${v}=x\n` },
			{ name: 'eof-no-newline', safe: oneLine, build: (v) => `A=${v}` },
		],
	},
	{
		languageId: 'javascript',
		aliases: ['javascript', 'js', 'jsx', 'mjs', 'cjs', 'javascriptreact'],
		extension: 'js',
		wrappers: [
			{ name: 'import', safe: noQuote, build: (v) => `import x from '${v}';\n` },
			{
				name: 'require',
				safe: noQuote,
				build: (v) => `const x = require('${v}');\n`,
			},
			{ name: 'dynamic', safe: noQuote, build: (v) => `await import("${v}");\n` },
			{ name: 'export', safe: noQuote, build: (v) => `export * from '${v}';\n` },
			{ name: 'comment', safe: oneLine, build: (v) => `// ${v}\nconst a = 1;\n` },
			{ name: 'eof-no-newline', safe: noQuote, build: (v) => `import '${v}';` },
		],
	},
	{
		languageId: 'typescript',
		aliases: ['typescript', 'ts', 'tsx', 'mts', 'cts', 'typescriptreact'],
		extension: 'ts',
		wrappers: [
			{
				name: 'import',
				safe: noQuote,
				build: (v) => `import type X from '${v}';\n`,
			},
			{
				name: 'require',
				safe: noQuote,
				build: (v) => `const x = require('${v}');\n`,
			},
			{
				name: 'mid-line',
				safe: noQuote,
				build: (v) => `const a = 1; import('${v}');\n`,
			},
			{
				name: 'eof-no-newline',
				safe: noQuote,
				build: (v) => `export * from '${v}';`,
			},
		],
	},
	{
		languageId: 'html',
		aliases: ['html', 'htm', 'xhtml'],
		extension: 'html',
		wrappers: [
			{ name: 'attribute', safe: noQuote, build: (v) => `<a href="${v}">x</a>\n` },
			{ name: 'src', safe: noQuote, build: (v) => `<img src="${v}" alt="x">\n` },
			{
				name: 'srcset',
				safe: noQuote,
				build: (v) => `<img srcset="${v} 1x, ${v} 2x">\n`,
			},
			{
				name: 'mid-line',
				safe: noQuote,
				build: (v) => `<p>text <img src="${v}"> more</p>\n`,
			},
			{ name: 'comment', safe: oneLine, build: (v) => `<!-- ${v} -->\n<p>x</p>\n` },
			{ name: 'eof-no-newline', safe: noQuote, build: (v) => `<link href="${v}">` },
		],
	},
	{
		languageId: 'css',
		aliases: ['css'],
		extension: 'css',
		wrappers: [
			{ name: 'import', safe: noQuote, build: (v) => `@import url("${v}");\n` },
			{
				name: 'url',
				safe: noQuote,
				build: (v) => `.a { background: url("${v}"); }\n`,
			},
			{
				name: 'comment',
				safe: oneLine,
				build: (v) => `/* ${v} */\n.a { color: red; }\n`,
			},
			{ name: 'eof-no-newline', safe: noQuote, build: (v) => `@import "${v}";` },
		],
	},
	{
		languageId: 'scss',
		aliases: ['scss', 'sass', 'less'],
		extension: 'scss',
		wrappers: [
			{ name: 'import', safe: noQuote, build: (v) => `@import "${v}";\n` },
			{
				name: 'nested',
				safe: noQuote,
				build: (v) => `.a { .b { background: url("${v}"); } }\n`,
			},
			{
				name: 'eof-no-newline',
				safe: noQuote,
				build: (v) => `.a { background: url(${v}); }`,
			},
		],
	},
	{
		languageId: 'markdown',
		aliases: ['markdown', 'md'],
		extension: 'md',
		wrappers: [
			{ name: 'link', safe: oneLine, build: (v) => `See [docs](${v}) for more.\n` },
			{ name: 'code-span', safe: oneLine, build: (v) => `Run \`${v}\` first.\n` },
			{ name: 'quoted', safe: noQuote, build: (v) => `Open "${v}" now.\n` },
			{ name: 'mid-line', safe: oneLine, build: (v) => `text ${v} text\n` },
			{ name: 'eof-no-newline', safe: oneLine, build: (v) => `see ${v}` },
		],
	},
	{
		// The motivating case. `xml` is read by the generic scan on both
		// sides and is deliberately absent from the advertised enum, so
		// nothing but this holds the two servers to the same extractor.
		languageId: 'xml',
		aliases: ['xml'],
		extension: 'xml',
		wrappers: [
			{ name: 'attribute', safe: noQuote, build: (v) => `<r><n href="${v}"/></r>\n` },
			{ name: 'text', safe: oneLine, build: (v) => `<r><n>${v}</n></r>\n` },
			{ name: 'comment', safe: oneLine, build: (v) => `<!-- ${v} -->\n<r/>\n` },
			{ name: 'eof-no-newline', safe: noQuote, build: (v) => `<r n="${v}"/>` },
		],
	},
	{
		// A name neither server knows: it must land on the generic scan
		// rather than on a refusal, and on the *same* generic scan.
		languageId: 'python',
		aliases: ['python', 'go', 'rust', 'dockerfile', 'jso'],
		extension: 'py',
		wrappers: [
			{ name: 'call', safe: noQuote, build: (v) => `open("${v}")\n` },
			{ name: 'assignment', safe: noQuote, build: (v) => `DEST = '${v}'\n` },
			{ name: 'comment', safe: oneLine, build: (v) => `# ${v}\npass\n` },
			{ name: 'bare', safe: oneLine, build: (v) => `shutil.copy(${v}, DEST)\n` },
			{ name: 'eof-no-newline', safe: noQuote, build: (v) => `p = "${v}"` },
		],
	},
] as const;

type Call = {
	readonly index: number;
	readonly format: Format;
	readonly wrapper: string;
	readonly value: string;
	readonly shape: string;
	readonly arguments: Record<string, unknown>;
};

/**
 * The argument shapes the tool actually gets asked with. `format` and
 * `filename` are two routes to one answer, `dedupe` and `maxResults`
 * reshape the result, and a nonsensical cap takes the refusal path —
 * where the two servers have to agree on the *message*, not just on the
 * paths.
 */
function shapes(format: Format, name: string, next: () => number) {
	const alias = format.aliases[Math.floor(next() * format.aliases.length)];
	// A format name arrives from an agent or a shell, so it arrives
	// padded. The two languages disagree about which invisible characters
	// count as padding, and that disagreement resolves one name two ways.
	const padding = ['', ' ', '\t', '\u{feff}', '\u{85}', '\u{a0}'];
	const padded = `${padding[Math.floor(next() * padding.length)]}${alias}`;
	return [
		{ name: 'format', arguments: { format: alias } },
		{ name: 'format-padded', arguments: { format: padded } },
		{ name: 'filename', arguments: { filename: name } },
		{ name: 'dedupe', arguments: { format: alias, dedupe: true } },
		{
			name: 'maxResults',
			arguments: { format: alias, maxResults: 1 + Math.floor(next() * 3) },
		},
		{ name: 'refusal', arguments: { format: alias, maxResults: 0 } },
	];
}

function generate(): Call[] {
	const next = random(SEED);
	const calls: Call[] = [];
	for (let index = 0; index < COUNT; index += 1) {
		const format = FORMATS[index % FORMATS.length];
		const value = VALUES[Math.floor(next() * VALUES.length)];
		const usable = format.wrappers.filter((w) => w.safe?.(value) ?? true);
		// Every format keeps at least one wrapper for every value; one
		// whose wrappers all refuse a value would silently drop it.
		if (usable.length === 0) {
			throw new Error(
				`${format.languageId} can express none of ${JSON.stringify(value)}`,
			);
		}
		const wrapper = usable[Math.floor(next() * usable.length)];
		const available = shapes(
			format,
			`document-${index}.${format.extension}`,
			next,
		);
		const shape = available[Math.floor(next() * available.length)];
		calls.push({
			index,
			format,
			wrapper: wrapper.name,
			value,
			shape: shape.name,
			arguments: { content: wrapper.build(value), ...shape.arguments },
		});
	}
	return calls;
}

/** The built binary. Built by the workflow; named here when it is not. */
function binary(): string {
	const named = process.env.PATHS_LE_BIN;
	if (named !== undefined && existsSync(named)) return named;
	for (const profile of ['release', 'debug']) {
		const candidate = join(ROOT, 'crate', 'target', profile, 'paths-le');
		if (existsSync(candidate)) return candidate;
	}
	console.error(
		'no paths-le binary found: run `cargo build --release` in crate/, or set PATHS_LE_BIN',
	);
	process.exit(2);
}

/**
 * Key order is not part of the JSON data model, so canonicalise before
 * comparing: two envelopes that differ only in the order their keys were
 * written are the same answer, and the corpus check in `cargo test`
 * compares structurally for the same reason.
 */
function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (value === null || typeof value !== 'object') return value;
	const entries = Object.entries(value as Record<string, unknown>).sort(
		([a], [b]) => (a < b ? -1 : 1),
	);
	return entries.map(([key, item]) => [key, canonical(item)]);
}

const stable = (value: unknown) => JSON.stringify(canonical(value));

/** What one server answered: an envelope, or the refusal it produced. */
type Answer = { envelope?: unknown; error?: string };

/**
 * Every call, through the Rust server in one session — the transport is
 * part of the tool, so the requests go over JSON-RPC on stdio rather
 * than into a function.
 */
function fromCrate(executable: string, calls: readonly Call[]): Map<number, Answer> {
	const requests = calls
		.map((call) =>
			JSON.stringify({
				jsonrpc: '2.0',
				id: call.index,
				method: 'tools/call',
				params: { name: 'extract_paths', arguments: call.arguments },
			}),
		)
		.join('\n');

	const result = spawnSync(executable, ['mcp'], {
		input: `${requests}\n`,
		encoding: 'utf8',
		maxBuffer: 256 * 1024 * 1024,
	});
	if (result.status === null) {
		console.error(`the crate's server was killed by a signal (seed ${SEED})`);
		process.exit(1);
	}
	if (result.status !== 0) {
		console.error(
			`the crate's server exited ${result.status} (seed ${SEED}):\n${result.stderr}`,
		);
		process.exit(1);
	}

	const answers = new Map<number, Answer>();
	for (const line of result.stdout.split('\n')) {
		if (line.trim() === '') continue;
		const response = JSON.parse(line) as {
			id: number;
			result?: {
				structuredContent?: unknown;
				isError?: boolean;
				content?: ReadonlyArray<{ text?: string }>;
			};
			error?: { message?: string };
		};
		if (response.result?.isError === true) {
			answers.set(response.id, {
				error: response.result.content?.[0]?.text ?? '',
			});
			continue;
		}
		if (response.error !== undefined) {
			answers.set(response.id, {
				error: `protocol error: ${response.error.message ?? ''}`,
			});
			continue;
		}
		answers.set(response.id, { envelope: response.result?.structuredContent });
	}
	return answers;
}

/** The same call, through the npm server's handler. */
async function fromExtension(call: Call): Promise<Answer> {
	const tool = TOOLS.find((candidate) => candidate.name === 'extract_paths');
	if (tool === undefined) {
		console.error('the extension no longer offers extract_paths');
		process.exit(1);
	}
	try {
		return { envelope: JSON.parse(JSON.stringify(await tool.handler(call.arguments))) };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}

const calls = generate();
console.log(
	`differential: ${calls.length} extract_paths calls, ${FORMATS.length} formats, seed ${SEED}`,
);

const crate = fromCrate(binary(), calls);
const failures: string[] = [];

for (const call of calls) {
	const ours = crate.get(call.index);
	if (ours === undefined) {
		failures.push(
			`call ${call.index}: the crate's server never answered (${call.format.languageId} / ${call.shape})`,
		);
		continue;
	}
	const theirs = await fromExtension(call);
	if (stable(ours) === stable(theirs)) continue;
	failures.push(
		[
			`call ${call.index}: ${call.format.languageId} / ${call.wrapper} / ${call.shape} / ${JSON.stringify(call.value)}`,
			`  arguments: ${JSON.stringify(call.arguments)}`,
			`  npm server:   ${JSON.stringify(theirs)}`,
			`  crate server: ${JSON.stringify(ours)}`,
		].join('\n'),
	);
}

if (failures.length > 0) {
	console.error(
		`\nThe two servers disagree on ${failures.length} of ${calls.length} extract_paths calls (seed ${SEED}).\n` +
			'This is the SHARED tool, not the two surfaces: one tool name, one schema,\n' +
			'two implementations, and an agent must get the same answer from either.\n' +
			'A difference here is a defect in one of them — it is not a surface\n' +
			'decision, and it does not belong in SPEC.md as a divergence.\n',
	);
	for (const failure of failures) console.error(`${failure}\n`);
	console.error(
		`Reproduce exactly: bun scripts/check-extraction-differential.ts --seed ${SEED} --count ${COUNT}`,
	);
	process.exit(1);
}
console.log(
	`OK: both servers answer extract_paths identically for all ${calls.length} generated calls.`,
);
