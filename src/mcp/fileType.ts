/**
 * Resolving a format hint from whatever an agent happens to send.
 *
 * The engine's own `determineFileType` accepts VS Code language ids and nothing
 * else. An agent will send `yml`, `.env`, `jsx` or `tsconfig.json` instead.
 * Widening happens here rather than in the engine, whose behaviour is pinned by
 * characterization goldens.
 */

/** Every language id the engine understands, keyed by what a caller might send. */
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
});

/** The formats a caller can name, for the tool schema's enum. */
export const SUPPORTED_FORMATS: readonly string[] = Object.freeze([
	'csv',
	'toml',
	'dotenv',
	'javascript',
	'typescript',
	'json',
	'html',
	'css',
]);

function normalise(value: string): string {
	return value.trim().toLowerCase().replace(/^\./, '');
}

/**
 * Resolve a language id from an explicit format, else from a filename.
 *
 * Returns null rather than guessing: a wrong format extracts nothing and looks
 * like a document with no paths, which is the least debuggable outcome for a
 * caller.
 */
export function resolveFormat(
	format: string | undefined,
	filename: string | undefined,
): string | null {
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

	return null;
}
