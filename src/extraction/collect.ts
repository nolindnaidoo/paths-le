import type { Path } from '../types';

/**
 * Recursively collect path-like values from any object structure
 * Used by format-specific extractors to traverse parsed data
 */
export function collectPaths(obj: unknown, context: string = 'root'): Path[] {
	const paths: Path[] = [];

	if (typeof obj === 'string') {
		if (isPathLike(obj)) {
			paths.push({
				value: obj,
				type: classifyPathType(obj),
				position: {
					line: 1,
					column: 1,
				},
				context,
			});
		}
	} else if (Array.isArray(obj)) {
		for (let i = 0; i < obj.length; i++) {
			const item = obj[i];
			if (item !== null && item !== undefined) {
				paths.push(...collectPaths(item, `${context}[${i}]`));
			}
		}
	} else if (obj && typeof obj === 'object') {
		for (const [key, value] of Object.entries(obj)) {
			if (value !== null && value !== undefined) {
				// Check if the key itself looks like a path
				if (isPathLike(key)) {
					paths.push({
						value: key,
						type: classifyPathType(key),
						position: {
							line: 1,
							column: 1,
						},
						context: `${context}.key`,
					});
				}
				paths.push(...collectPaths(value, `${context}.${key}`));
			}
		}
	}

	return paths;
}

/**
 * Check if a string looks like a file path
 */
function isPathLike(value: string): boolean {
	if (!value || value.length < 2) return false;

	// Common path patterns
	const patterns = [
		/^\/[^\s"'<>|*?]+$/, // Unix absolute paths
		/^[A-Za-z]:\\[^\s"'<>|*?]+$/, // Windows absolute paths
		/^\.\.?\/[^\s"'<>|*?]+$/, // Relative paths
		/^https?:\/\/[^\s"'<>|*?]+$/, // URLs
		/^file:\/\/[^\s"'<>|*?]+$/, // File URLs
		/^[^\s"'<>|*?]+\.[a-zA-Z0-9]+$/, // Files with extensions
		/^[^\s"'<>|*?]+\/[^\s"'<>|*?]+$/, // Directory/file patterns
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
