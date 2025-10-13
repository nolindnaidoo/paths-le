import type { Path } from '../../types';

/**
 * Extract paths from JSON files
 * Recursively searches for path-like string values
 */
export function extractFromJson(content: string): Path[] {
	if (content.trim().length === 0) return [];

	try {
		const parsed = JSON.parse(content);
		const paths: Path[] = [];
		extractPathsFromValue(parsed, paths, [], 1);
		return paths;
	} catch (_error) {
		// Return empty array on parse error
		return [];
	}
}

/**
 * Recursively extract paths from a JSON value
 */
function extractPathsFromValue(
	value: unknown,
	paths: Path[],
	keyPath: string[],
	lineOffset: number,
): void {
	if (typeof value === 'string' && isPathLike(value)) {
		paths.push({
			value,
			type: classifyPathType(value),
			position: {
				line: lineOffset,
				column: 1,
			},
			context: `JSON ${keyPath.length > 0 ? keyPath.join('.') : 'value'}`,
		});
	} else if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) {
			extractPathsFromValue(
				value[i],
				paths,
				[...keyPath, `[${i}]`],
				lineOffset,
			);
		}
	} else if (value && typeof value === 'object') {
		for (const [key, val] of Object.entries(value)) {
			extractPathsFromValue(val, paths, [...keyPath, key], lineOffset);
		}
	}
}

/**
 * Check if a string looks like a file path
 */
function isPathLike(value: string): boolean {
	if (!value || value.length < 3) return false;

	// Common path patterns
	const patterns = [
		/^\/[^"'<>|*?]+(?:\/[^"'<>|*?]*)*$/, // Unix absolute paths
		/^[A-Za-z]:\\[^"'<>|*?]+(?:\\[^"'<>|*?]*)*$/, // Windows absolute paths
		/^\.\.?\/[^"'<>|*?]+(?:\/[^"'<>|*?]*)*$/, // Relative paths
		/^https?:\/\/[^"'<>|*?\s]+$/, // URLs
		/^file:\/\/[^"'<>|*?\s]+$/, // File URLs
		/^[^"'<>|*?\s/\\]{3,}\.[a-zA-Z]{2,}$/, // Files with extensions (min 3 chars before dot, 2+ letter extension)
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
