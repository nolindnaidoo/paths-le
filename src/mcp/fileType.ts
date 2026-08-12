/**
 * Resolving a format hint from whatever an agent happens to send.
 *
 * The engine's own `determineFileType` accepts VS Code language ids and nothing
 * else. An agent will send `yml`, `.env`, `jsx` or `tsconfig.json` instead.
 * Widening happens here rather than in the engine, whose behaviour is pinned by
 * characterization goldens.
 *
 * **Nothing fails to resolve.** A name neither layer recognises lands on the
 * generic scan rather than on a refusal, so a Python file, a Dockerfile and a
 * `.md` are read instead of being turned away.
 */

/**
 * Every language id the engine understands, keyed by what a caller might send.
 *
 * `markdown` and `xml` map to themselves and then to the generic scan. They
 * earn a row because the row is what puts the real name in the answer — a `.md`
 * file reads as `markdown` rather than as `unknown`, which is the difference
 * between "scanned generically" and "not recognised at all".
 */
const ALIASES: Readonly<Record<string, string>> = Object.freeze({
	csv: 'csv',
	tsv: 'csv',
	toml: 'toml',
	dotenv: 'dotenv',
	env: 'dotenv',
	javascript: 'javascript',
	js: 'javascript',
	jsx: 'javascript',
	mjs: 'javascript',
	cjs: 'javascript',
	javascriptreact: 'javascript',
	typescript: 'typescript',
	ts: 'typescript',
	tsx: 'typescript',
	mts: 'typescript',
	cts: 'typescript',
	typescriptreact: 'typescript',
	json: 'json',
	jsonc: 'json',
	html: 'html',
	htm: 'html',
	xhtml: 'html',
	css: 'css',
	scss: 'scss',
	sass: 'scss',
	less: 'less',
	yaml: 'yaml',
	yml: 'yaml',
	markdown: 'markdown',
	md: 'markdown',
	xml: 'xml',
});

/**
 * The formats a caller can name, for the tool schema's enum.
 *
 * `markdown` is here and `xml` is not, even though both are read by the generic
 * scan: `markdown` is a format an agent asks for by name, and the enum is what
 * tells it the ask is understood. Anything absent from this list still
 * resolves — the enum advertises, it does not gate.
 */
export const SUPPORTED_FORMATS: readonly string[] = Object.freeze([
	'csv',
	'toml',
	'dotenv',
	'javascript',
	'typescript',
	'json',
	'html',
	'css',
	'yaml',
	'markdown',
]);

/**
 * What the engine uses when it recognises nothing.
 *
 * `unknown`, not `fallback`: the engine's `determineFileType` already answers
 * `unknown` for a language it has no extractor for, and the name is
 * user-visible — it is the `fileType` every MCP answer carries, so a second
 * name here would be the two servers disagreeing on a field in plain sight.
 */
export const FALLBACK_FORMAT = 'unknown';

function normalise(value: string): string {
	return value.trim().toLowerCase().replace(/^\./, '');
}

/**
 * Resolve a language id from an explicit format, else from a filename, else the
 * generic scan.
 *
 * A caller who knows nothing about a document still gets its paths, which is
 * the difference between a tool that can be pointed at a repository and one
 * that has to have the repository described to it first.
 */
export function resolveFormat(
	format: string | undefined,
	filename: string | undefined,
): string {
	if (format) {
		const direct = ALIASES[normalise(format)];
		if (direct) return direct;
	}

	if (filename) {
		// A dotfile like `.env` has no extension to split on; its whole name is
		// the type, which is exactly the case an agent sends most often here.
		const bare = normalise(filename);
		const whole = ALIASES[bare.startsWith('.') ? bare.slice(1) : bare];
		if (whole) return whole;

		const extension = filename.includes('.')
			? filename.slice(filename.lastIndexOf('.') + 1)
			: '';
		const inferred = ALIASES[normalise(extension)];
		if (inferred) return inferred;
	}

	return FALLBACK_FORMAT;
}
