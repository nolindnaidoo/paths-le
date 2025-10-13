import { parse } from '@iarna/toml';
import type { Path } from '../../types';

/**
 * Extract paths from TOML files
 * Recursively searches through TOML structure for path-like values
 */
export function extractFromToml(content: string): Path[] {
	if (content.trim().length === 0) return [];

	try {
		const parsed = parse(content);
		const paths: Path[] = [];
		extractPathsFromObject(parsed, paths, 1);
		return paths;
	} catch (_error) {
		// Return empty array on parse error
		return [];
	}
}

/**
 * Recursively extract paths from a TOML object
 */
function extractPathsFromObject(
	obj: unknown,
	paths: Path[],
	lineOffset: number,
): void {
	if (typeof obj === 'string' && isPathLike(obj)) {
		paths.push({
			value: obj,
			type: classifyPathType(obj),
			position: {
				line: lineOffset,
				column: 1,
			},
			context: 'TOML value',
		});
	} else if (Array.isArray(obj)) {
		for (const item of obj) {
			extractPathsFromObject(item, paths, lineOffset);
		}
	} else if (obj && typeof obj === 'object') {
		for (const [key, value] of Object.entries(obj)) {
			// Check if the key itself looks like a path
			if (isPathLike(key)) {
				paths.push({
					value: key,
					type: classifyPathType(key),
					position: {
						line: lineOffset,
						column: 1,
					},
					context: 'TOML key',
				});
			}
			extractPathsFromObject(value, paths, lineOffset);
		}
	}
}

/**
 * Check if a string looks like a file path
 */
function isPathLike(value: string): boolean {
	if (!value || value.length < 2) return false;

	// Common path patterns - more flexible to catch valid paths including spaces
	const patterns = [
		/^\/[^"'<>|*?]+(?:\/[^"'<>|*?]*)*$/, // Unix absolute paths (allow spaces)
		/^[A-Za-z]:\\[^"'<>|*?]+(?:\\[^"'<>|*?]*)*$/, // Windows absolute paths (allow spaces)
		/^\.\.?\/[^"'<>|*?]+(?:\/[^"'<>|*?]*)*$/, // Relative paths (allow spaces)
		/^https?:\/\/[^"'<>|*?]+$/, // URLs
		/^file:\/\/[^"'<>|*?]+$/, // File URLs
		/^[^"'<>|*?]+\.[a-zA-Z0-9]+$/, // Files with extensions (allow spaces)
		/^[^"'<>|*?]+\/[^"'<>|*?]+$/, // Directory/file patterns (allow spaces)
	];

	return patterns.some((pattern) => pattern.test(value));
}

/**
 * Classify the type of path
 */
function classifyPathType(
	path: string,
): 'file' | 'directory' | 'relative' | 'absolute' | 'url' | 'unknown' {
	if (
		path.startsWith('http://') ||
		path.startsWith('https://') ||
		path.startsWith('file://')
	) {
		return 'url';
	}
	if (path.startsWith('/')) {
		return 'absolute';
	}
	if (
		path.startsWith('C:\\') ||
		path.startsWith('D:\\') ||
		/^[A-Za-z]:\\/.test(path)
	) {
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
