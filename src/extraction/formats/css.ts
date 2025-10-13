import type { Path } from '../../types';

/**
 * Extract paths from CSS files
 * Extracts url() and @import paths
 */
export function extractFromCss(content: string): Path[] {
	if (content.trim().length === 0) return [];

	const paths: Path[] = [];
	const lines = content.split('\n');

	// Patterns for CSS paths
	const urlPattern = /url\s*\(\s*['"]?([^'"()]+?)['"]?\s*\)/gi;
	const importPattern =
		/@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"](?:\s*\))?/gi;

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		if (!line) continue;

		// If line contains @import, prefer extracting only @import to avoid double-counting url() inside
		if (/@import\b/.test(line)) {
			importPattern.lastIndex = 0;
			let importMatch: RegExpExecArray | null;
			while ((importMatch = importPattern.exec(line)) !== null) {
				const pathValue = importMatch[1]?.trim();
				if (pathValue) {
					paths.push({
						value: pathValue,
						type: classifyPathType(pathValue),
						position: {
							line: lineIndex + 1,
							column: importMatch.index + 1,
						},
						context: 'CSS @import',
					});
				}
			}
			continue;
		}

		// Otherwise, extract url() values
		urlPattern.lastIndex = 0;
		let urlMatch: RegExpExecArray | null;
		while ((urlMatch = urlPattern.exec(line)) !== null) {
			const pathValue = urlMatch[1]?.trim();
			if (pathValue && !isDataUrl(pathValue)) {
				paths.push({
					value: pathValue,
					type: classifyPathType(pathValue),
					position: {
						line: lineIndex + 1,
						column: urlMatch.index + 1,
					},
					context: 'CSS url()',
				});
			}
		}
	}

	return paths;
}

/**
 * Check if a URL is a data URL (should be excluded)
 */
function isDataUrl(value: string): boolean {
	return value.startsWith('data:');
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
		path.startsWith('//')
	) {
		return 'url';
	}
	if (path.startsWith('/')) {
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
