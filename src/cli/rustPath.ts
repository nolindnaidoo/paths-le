/**
 * Rust's `std::path` arithmetic over plain strings: components, lexical `..`,
 * prefix tests and relative spellings, as `resolve.rs` uses them.
 *
 * Node's `path` module answers several of these differently. `path.normalize`
 * keeps a leading `..` that `PathBuf::pop` cannot climb past and
 * `path.relative` collapses where Rust compares component by component, and
 * every difference reaches the report as a different `canonical` or a
 * different verdict from the binary of the same name.
 */
import { sep } from 'node:path';

const WINDOWS = sep === '\\';

/** `Component::RootDir`. A real name is never empty, so this cannot collide. */
export const ROOT_DIR = '';
const CUR_DIR = '.';
const PARENT_DIR = '..';

const DRIVE = /^[A-Za-z]:/;

/** `Path::components`: no empty names, and `.` only as the first component. */
export function components(path: string): string[] {
	const found: string[] = [];
	let rest = path;
	const drive = WINDOWS ? DRIVE.exec(rest) : null;
	if (drive) {
		found.push(drive[0]);
		rest = rest.slice(drive[0].length);
	}
	const parts = rest.split(WINDOWS ? /[\\/]/ : '/');
	if (rest.length > 0 && parts[0] === '') found.push(ROOT_DIR);
	parts.forEach((part, index) => {
		if (part === '') return;
		if (part === CUR_DIR) {
			if (index === 0 && found.length === 0) found.push(CUR_DIR);
			return;
		}
		found.push(part);
	});
	return found;
}

/** What a `PathBuf` collected from these components prints as. */
export function render(parts: readonly string[]): string {
	const head = parts[0];
	const isPrefix = head !== undefined && WINDOWS && DRIVE.test(head);
	const prefix = isPrefix ? head : '';
	const after = isPrefix ? parts.slice(1) : [...parts];
	const rooted = after[0] === ROOT_DIR;
	const names = rooted ? after.slice(1) : after;
	return `${prefix}${rooted ? sep : ''}${names.join(sep)}`;
}

/** `Path::is_absolute`: a root, and on Windows a drive before it as well. */
export function isAbsolute(path: string): boolean {
	const parts = components(path);
	if (!WINDOWS) return parts[0] === ROOT_DIR;
	return (
		parts.length > 1 && DRIVE.test(parts[0] ?? '') && parts[1] === ROOT_DIR
	);
}

/** `base.join(value)`, then `.` and `..` resolved without touching the disk. */
export function joinNormalised(base: string, value: string): string[] {
	const joined = isAbsolute(value)
		? components(value)
		: [...components(base), ...components(value)];
	return lexicalNormalise(joined);
}

export function lexicalNormalise(parts: readonly string[]): string[] {
	const out: string[] = [];
	for (const part of parts) {
		if (part === CUR_DIR) continue;
		if (part === PARENT_DIR) {
			pop(out);
			continue;
		}
		out.push(part);
	}
	return out;
}

/** `PathBuf::pop`: nothing above a root or a drive, and nothing from empty. */
function pop(parts: string[]): void {
	const last = parts.at(-1);
	if (last === undefined || last === ROOT_DIR) return;
	if (WINDOWS && parts.length === 1 && DRIVE.test(last)) return;
	parts.pop();
}

export function startsWith(
	path: readonly string[],
	base: readonly string[],
): boolean {
	if (base.length > path.length) return false;
	return base.every((part, index) => part === path[index]);
}

/**
 * `target` spelled from `root`, climbing with `..` where it lands outside.
 * `null` when the two share no first component, two Windows drives, since no
 * relative spelling joins them.
 */
export function relativeTo(
	target: readonly string[],
	root: readonly string[],
): string[] | null {
	if (target[0] !== root[0]) return null;
	let shared = 0;
	while (
		shared < target.length &&
		shared < root.length &&
		target[shared] === root[shared]
	)
		shared++;
	const relative = [
		...Array<string>(root.length - shared).fill(PARENT_DIR),
		...target.slice(shared),
	];
	return relative.length === 0 ? [CUR_DIR] : relative;
}

/** `Path::file_name`: the last component when it is a name. */
export function fileName(parts: readonly string[]): string | null {
	const last = parts.at(-1);
	if (last === undefined || last === ROOT_DIR || last === PARENT_DIR)
		return null;
	if (last === CUR_DIR) return null;
	if (WINDOWS && parts.length === 1 && DRIVE.test(last)) return null;
	return last;
}

/**
 * The directory `path` sits in. A bare filename has a parent of `""` in Rust,
 * which no syscall accepts, so it is the working directory instead.
 */
export function parentDir(path: string): string {
	const parts = components(path);
	const name = fileName(parts);
	if (name === null) return CUR_DIR;
	const parent = render(parts.slice(0, -1));
	return parent === '' ? CUR_DIR : parent;
}

/**
 * A path as the report writes it: separators forward on every platform, and
 * Windows' `\\?\` verbatim prefix dropped. Only on Windows, because `\` is a
 * legal character in a Unix filename.
 */
export function display(path: string): string {
	if (!WINDOWS) return path;
	return forwardSlashes(path);
}

export function forwardSlashes(rendered: string): string {
	if (rendered.startsWith('\\\\?\\UNC\\'))
		return `//${rendered.slice(8).replaceAll('\\', '/')}`;
	const bare = rendered.startsWith('\\\\?\\') ? rendered.slice(4) : rendered;
	return bare.replaceAll('\\', '/');
}
