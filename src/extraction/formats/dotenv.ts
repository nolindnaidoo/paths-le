import type { Path } from '../../types';

/**
 * Extract paths from .env files
 * Looks for path-like values in environment variable assignments
 */
export function extractFromDotenv(content: string): Path[] {
	if (content.trim().length === 0) return [];

	const lines = content.split('\n');
	const paths: Path[] = [];

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex]?.trim() || '';

		// Skip comments and empty lines
		if (line.startsWith('#') || line.length === 0) continue;

		// Look for KEY=VALUE patterns
		const match = line.match(/^([^=]+)=(.*)$/);
		if (match) {
			const key = match[1];
			const value = match[2];
			if (!key || !value) continue;

			const cleanValue = value
				.replace(/^["']|["']$/g, '')
				.trim()
				.replace(/\\\\/g, '\\'); // Remove quotes and fix double backslashes

			// Check if the value looks like a path
			if (isPathLike(cleanValue)) {
				paths.push({
					value: cleanValue,
					type: classifyPathType(cleanValue),
					position: {
						line: lineIndex + 1,
						column: line.indexOf('=') + 1,
					},
					context: `Environment variable: ${key.trim()}`,
				});
			}

			// Check if the key itself looks like a path (less common but possible)
			const cleanKey = key.trim();
			if (isPathLike(cleanKey)) {
				paths.push({
					value: cleanKey,
					type: classifyPathType(cleanKey),
					position: {
						line: lineIndex + 1,
						column: 1,
					},
					context: 'Environment variable name',
				});
			}
		}

		// Handle quoted key=value patterns (less common)
		const quotedMatch = line.match(/^["']([^"']+)["']=(.*)$/);
		if (quotedMatch) {
			const key = quotedMatch[1];
			const value = quotedMatch[2];
			if (!key || !value) continue;

			const cleanValue = value
				.replace(/^["']|["']$/g, '')
				.trim()
				.replace(/\\\\/g, '\\');

			if (isPathLike(key)) {
				paths.push({
					value: key,
					type: classifyPathType(key),
					position: {
						line: lineIndex + 1,
						column: 1,
					},
					context: 'Environment variable name',
				});
			}

			if (isPathLike(cleanValue)) {
				paths.push({
					value: cleanValue,
					type: classifyPathType(cleanValue),
					position: {
						line: lineIndex + 1,
						column: line.indexOf('=') + 1,
					},
					context: `Environment variable: ${key}`,
				});
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
