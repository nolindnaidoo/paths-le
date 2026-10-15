/**
 * Does this path still point at anything? The Rust CLI's `resolve.rs`,
 * verdict for verdict, because the npm and Rust binaries both install as
 * `paths-le` and a finding must not depend on which one ran.
 *
 * The only module here that asks the filesystem about an extracted path. The
 * extension has no equivalent: it extracts, and this decides.
 */
import { lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { sep } from 'node:path';
import type { PathType } from '../types';
import {
	components,
	display,
	fileName,
	isAbsolute,
	joinNormalised,
	relativeTo,
	render,
	startsWith,
} from './rustPath';

export type Verdict =
	| 'ok'
	| 'symlinked'
	| 'non-canonical'
	| 'missing'
	| 'escapes-root'
	| 'unresolved';

export interface Resolution {
	readonly verdict: Verdict;
	readonly canonical: string | null;
	readonly symlink: string | null;
	readonly reason: string | null;
}

/**
 * `non-canonical` counts by default, because it is a path the extension would
 * have rewritten. A symlink counts only when asked: the extension treats
 * resolving one as an ordinary step.
 */
export function isFinding(verdict: Verdict, denySymlinks: boolean): boolean {
	if (verdict === 'symlinked') return denySymlinks;
	return (
		verdict === 'missing' ||
		verdict === 'escapes-root' ||
		verdict === 'non-canonical'
	);
}

export function unresolved(reason: string): Resolution {
	return Object.freeze({
		verdict: 'unresolved',
		canonical: null,
		symlink: null,
		reason,
	});
}

/**
 * `baseDir` is the directory of the file the path was found in, never the
 * working directory. `root` must already be canonical, or the escape check
 * compares two spellings of the same directory.
 */
export function resolvePath(
	value: string,
	kind: PathType,
	baseDir: string,
	root: string,
): Resolution {
	const declined = notAFilesystemPath(value, kind);
	if (declined) return unresolved(declined);

	const absolute = isAbsolute(value);
	const target = joinNormalised(baseDir, value);
	const rootParts = components(root);

	// An absolute path is absolute by intent, not an escape.
	if (!absolute && !startsWith(target, rootParts)) {
		return resolution(
			'escapes-root',
			locate(target, rootParts, absolute),
			null,
			null,
		);
	}

	const targetPath = render(target);
	const symlink = linkTarget(targetPath);
	const direct = canonicalize(targetPath);
	const found =
		direct !== null
			? { canonical: direct, probed: null }
			: probeExtensions(target);

	if (found === null) {
		// `lstat` succeeding proves the value named something real, so a
		// broken link is a finding whatever its shape.
		if (symlink === null && !commitsToBeingAPath(value)) {
			return unresolved(
				'nothing here by that name, and the value does not commit to being a path — ' +
					'no leading ./ and no file extension, so its absence is not evidence',
			);
		}
		return resolution(
			'missing',
			locate(target, rootParts, absolute),
			symlink,
			symlink !== null ? 'a broken symlink' : 'no such file or directory',
		);
	}

	const canonical = locate(components(found.canonical), rootParts, absolute);
	if (found.probed !== null) {
		return resolution(
			'ok',
			canonical,
			symlink,
			`written without an extension; resolved to ${found.probed}`,
		);
	}
	const ambiguity = nonCanonicalReason(value);
	if (ambiguity !== null)
		return resolution('non-canonical', canonical, symlink, ambiguity);
	if (symlink !== null)
		return resolution('symlinked', canonical, symlink, null);
	return resolution('ok', canonical, null, null);
}

function notAFilesystemPath(value: string, kind: PathType): string | null {
	if (kind === 'url') return 'not a filesystem path';
	if (value.startsWith('#')) return 'a fragment, not a filesystem path';
	// Only http, https and file classify as `url`, so `ftp://` and
	// `postgresql://` arrive here looking like paths.
	if (value.includes('://'))
		return 'a scheme-qualified locator, not a filesystem path';
	if (isWindowsPath(value) && sep !== '\\')
		return 'a Windows path, not resolvable on this platform';
	return null;
}

function resolution(
	verdict: Verdict,
	canonical: string | null,
	symlink: string | null,
	reason: string | null,
): Resolution {
	return Object.freeze({ verdict, canonical, symlink, reason });
}

/** The link's own target, when the path itself is a symlink. */
function linkTarget(path: string): string | null {
	try {
		if (!lstatSync(path).isSymbolicLink()) return null;
		return display(readlinkSync(path));
	} catch {
		return null;
	}
}

/** `std::fs::canonicalize`, which is `realpath(3)`. */
function canonicalize(path: string): string | null {
	try {
		return realpathSync.native(path);
	} catch {
		return null;
	}
}

/**
 * A missing claim needs evidence: the value says it is a path, or carries a
 * file extension after a separator. `image/png` and `@scope/pkg` do neither.
 */
function commitsToBeingAPath(value: string): boolean {
	if (isComposite(value)) return false;
	if (
		value.startsWith('./') ||
		value.startsWith('../') ||
		value.startsWith('/') ||
		isWindowsPath(value)
	)
		return true;
	const cut = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'));
	if (cut === -1) return false;
	const last = value.slice(cut + 1);
	const dot = last.lastIndexOf('.');
	return dot > 0 && dot < last.length - 1;
}

/** A colon past any drive letter joins several things: a volume, a PATH. */
function isComposite(value: string): boolean {
	const tail = isWindowsPath(value) ? value.slice(2) : value;
	return tail.includes(':');
}

/** Filesystem probing, not module resolution: every answer is a file you can `ls`. */
const MODULE_EXTENSIONS = Object.freeze([
	'ts',
	'tsx',
	'js',
	'jsx',
	'mjs',
	'cjs',
	'json',
]);

/** The written name plus an extension, never with its own extension replaced. */
function probeExtensions(
	target: readonly string[],
): { canonical: string; probed: string } | null {
	const name = fileName(target);
	if (name === null) return null;
	for (const extension of MODULE_EXTENSIONS) {
		const probed = `${name}.${extension}`;
		const canonical = canonicalize(render([...target.slice(0, -1), probed]));
		if (canonical !== null) return { canonical, probed };
	}
	return null;
}

/** A leading `./` or `../` is idiomatic and never a reason. */
function nonCanonicalReason(value: string): string | null {
	if (value.includes('//')) return 'contains a duplicate separator';
	if (value.length > 1 && value.endsWith('/')) return 'ends with a separator';
	if (value.includes('\\') && value.includes('/'))
		return 'mixes backslash and forward-slash separators';
	return hasEmbeddedTraversal(value) ? 'traverses upward mid-path' : null;
}

/** `a/../b`, but not `../../a`. */
function hasEmbeddedTraversal(value: string): boolean {
	let seenNamedSegment = false;
	for (const segment of value.split('/')) {
		if (segment === '..' && seenNamedSegment) return true;
		if (segment === '..' || segment === '.' || segment === '') continue;
		seenNamedSegment = true;
	}
	return false;
}

function isWindowsPath(value: string): boolean {
	return /^[A-Za-z]:[\\/]/.test(value);
}

/**
 * Relative to the root, so the auditing machine's home directory is in no
 * report. A path the document wrote absolute stays absolute.
 */
function locate(
	target: readonly string[],
	root: readonly string[],
	writtenAbsolute: boolean,
): string {
	if (writtenAbsolute) return display(render(target));
	const relative = relativeTo(target, root);
	return display(render(relative ?? target));
}
