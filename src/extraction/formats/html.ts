import type { Path } from '../../types';

/**
 * Extract paths from HTML files
 * Extracts standard path attributes: src, href, data, action, poster, etc.
 */
export function extractFromHtml(content: string): Path[] {
	if (content.trim().length === 0) return [];

	const paths: Path[] = [];
	const lines = content.split('\n');

	// Pattern for standard path attributes
	const attributePattern =
		/(src|href|data|action|poster|background|cite|formaction|icon|manifest|srcset)\s*=\s*["']([^"']+)["']/gi;

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		if (!line) continue;

		attributePattern.lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = attributePattern.exec(line)) !== null) {
			const attrName = match[1]?.toLowerCase();
			const attrValue = match[2];

			if (!attrValue) continue;

			// Handle srcset specially (can have multiple URLs)
			if (attrName === 'srcset') {
				extractFromSrcset(attrValue, lineIndex, match.index, paths);
			} else if (!isDataUrl(attrValue) && !isJavaScriptUrl(attrValue)) {
				paths.push({
					value: attrValue,
					type: classifyPathType(attrValue),
					position: {
						line: lineIndex + 1,
						column: match.index + 1,
					},
					context: `HTML ${attrName}`,
				});
			}
		}
	}

	return paths;
}

/**
 * Extract paths from srcset attribute (can have multiple URLs with descriptors)
 * Format: "image1.jpg 1x, image2.jpg 2x" or "image1.jpg 480w, image2.jpg 800w"
 */
function extractFromSrcset(
	srcset: string,
	lineIndex: number,
	columnIndex: number,
	paths: Path[],
): void {
	const entries = srcset.split(',');
	for (const entry of entries) {
		// Split by whitespace and take first part (the URL)
		const url = entry.trim().split(/\s+/)[0];
		if (url && !isDataUrl(url)) {
			paths.push({
				value: url,
				type: classifyPathType(url),
				position: {
					line: lineIndex + 1,
					column: columnIndex + 1,
				},
				context: 'HTML srcset',
			});
		}
	}
}

/**
 * Check if a URL is a data URL (should be excluded)
 */
function isDataUrl(value: string): boolean {
	return value.startsWith('data:');
}

/**
 * Check if a URL is a JavaScript URL (should be excluded)
 */
function isJavaScriptUrl(value: string): boolean {
	return value.startsWith('javascript:');
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
	if (path.startsWith('#')) {
		return 'unknown'; // Fragment identifier
	}
	if (path.includes('.')) {
		return 'file';
	}
	return 'unknown';
}
