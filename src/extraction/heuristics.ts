import type { PathType } from '../types';

/**
 * The single path heuristic shared by every format extractor.
 * v1.x had four divergent isPathLike copies and six classifyPathType
 * copies; the same string classified differently depending on format.
 *
 * Strongly-structured candidates (absolute, relative, drive-letter, URL)
 * may contain spaces — the input is always an already-delimited token
 * (a JSON string, an env value, a CSV cell). Weakly-structured
 * candidates (bare `name.ext`, `dir/file`) must not contain whitespace,
 * and `name.ext` must not be purely numeric — this is what keeps
 * version strings (1.8.1) and IP addresses out of the results.
 *
 * Known limitation: bare domains (`example.com`) still match `name.ext`
 * — indistinguishable from a filename without a TLD list.
 */

const FORBIDDEN = `"'<>|*?`;
const STRONG_PATTERNS: readonly RegExp[] = [
	/^\/[^"'<>|*?]+$/, // Unix absolute
	/^[A-Za-z]:[\\/][^"'<>|*?]*$/, // Windows drive
	/^\.\.?\/[^"'<>|*?]+$/, // relative
	/^https?:\/\/[^\s"'<>|*?]+$/, // URL (no spaces)
	/^file:\/\/[^\s"'<>|*?]+$/, // file URL (no spaces)
];
const WEAK_PATTERNS: readonly RegExp[] = [
	/^[^\s"'<>|*?]+\.[a-zA-Z0-9]+$/, // name.ext
	/^[^\s"'<>|*?]+\/[^\s"'<>|*?]+$/, // dir/file
];
const NUMERIC_DOTTED = /^[\d.]+$/;

export function isPathLike(value: string): boolean {
	if (value.length < 2) return false;
	if (containsForbidden(value)) return false;

	if (STRONG_PATTERNS.some((pattern) => pattern.test(value))) {
		return true;
	}

	if (NUMERIC_DOTTED.test(value)) {
		return false;
	}

	return WEAK_PATTERNS.some((pattern) => pattern.test(value));
}

function containsForbidden(value: string): boolean {
	for (const char of FORBIDDEN) {
		if (value.includes(char)) return true;
	}
	return false;
}

export function classifyPathType(path: string): PathType {
	if (
		path.startsWith('http://') ||
		path.startsWith('https://') ||
		path.startsWith('file://') ||
		(path.startsWith('//') && !path.startsWith('///'))
	) {
		return 'url';
	}
	if (path.startsWith('#')) {
		return 'unknown';
	}
	if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) {
		return 'absolute';
	}
	if (path.startsWith('./') || path.startsWith('../')) {
		return 'relative';
	}
	if (path.includes('.')) {
		return 'file';
	}
	return 'unknown';
}
