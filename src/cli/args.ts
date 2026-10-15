/**
 * The command line, parsed as the Rust CLI parses it: strictly, in order, and
 * refusing rather than defaulting. A typo'd `--stict` that silently did
 * nothing would report a clean audit that never ran the check asked for.
 */
import { resolveFormat } from '../mcp/fileType';
import { FLAGS } from './usage';
import type { WalkOptions } from './walk';

export interface Cli {
	readonly strict: boolean;
	readonly inputs: readonly string[];
	readonly stdin: boolean;
	/** The forced format. An unrecognised name is the generic scan, not a refusal. */
	readonly format: string | null;
	readonly root: string | null;
	readonly resolve: boolean;
	readonly resolveScanned: boolean;
	readonly denySymlinks: boolean;
	readonly walk: WalkOptions;
}

type Draft = { -readonly [K in keyof Cli]: Cli[K] };

export function parse(args: readonly string[]): Cli {
	const draft: Draft = {
		strict: false,
		inputs: [],
		stdin: false,
		format: null,
		root: null,
		resolve: true,
		resolveScanned: false,
		denySymlinks: false,
		walk: {
			hidden: false,
			respectIgnore: true,
			followSymlinks: false,
			format: null,
		},
	};

	for (let index = 0; index < args.length; index++) {
		const arg = args[index] as string;
		if (arg.startsWith('-') && !FLAGS.includes(arg)) {
			throw new Error(`${arg} is not an option. Try --help.`);
		}
		const takesValue = arg === '--format' || arg === '--root';
		const value = takesValue ? args[++index] : undefined;
		apply(draft, arg, value);
	}

	if (draft.stdin && draft.inputs.length > 0) {
		throw new Error('reading from stdin takes no file arguments');
	}
	if (!draft.stdin && draft.inputs.length === 0) {
		throw new Error('name a file or a directory to audit. Try --help.');
	}
	return Object.freeze(draft);
}

const SWITCHES: Readonly<Record<string, (draft: Draft) => void>> =
	Object.freeze({
		'--resolve': (draft) => {
			draft.resolveScanned = true;
		},
		'--no-resolve': (draft) => {
			draft.resolve = false;
		},
		'--deny-symlinks': (draft) => {
			draft.denySymlinks = true;
		},
		'--stdin': (draft) => {
			draft.stdin = true;
		},
		'--strict': (draft) => {
			draft.strict = true;
		},
		'--hidden': (draft) => {
			draft.walk = { ...draft.walk, hidden: true };
		},
		'--no-ignore': (draft) => {
			draft.walk = { ...draft.walk, respectIgnore: false };
		},
		'--follow-symlinks': (draft) => {
			draft.walk = { ...draft.walk, followSymlinks: true };
		},
	});

function apply(draft: Draft, arg: string, value: string | undefined): void {
	const toggle = SWITCHES[arg];
	if (toggle) {
		toggle(draft);
		return;
	}
	if (arg === '--root') {
		if (value === undefined) throw new Error('--root needs a directory');
		draft.root = value;
		return;
	}
	if (arg === '--format') {
		if (value === undefined) throw new Error('--format needs a format');
		// A typo shows up as `unknown` in the report rather than as a refusal:
		// there is a generic scan behind every name.
		const resolved = resolveFormat(value, undefined);
		draft.format = resolved;
		draft.walk = { ...draft.walk, format: resolved };
		return;
	}
	draft.inputs = [...draft.inputs, arg];
}
