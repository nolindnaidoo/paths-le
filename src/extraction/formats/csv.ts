import { parse } from 'csv-parse/sync';
import type { Path } from '../../types';

/**
 * Extract paths from CSV files
 * Looks for path-like values in CSV cells
 */
export function extractFromCsv(content: string): Path[] {
	if (content.trim().length === 0) return [];

	try {
		const rows = parse(content, {
			columns: false,
			bom: true,
			skip_empty_lines: true,
			relax_quotes: true,
			relax_column_count: true,
			trim: true,
		}) as unknown as ReadonlyArray<ReadonlyArray<string>>;

		const paths: Path[] = [];

		for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
			const row = rows[rowIndex] ?? [];
			for (let colIndex = 0; colIndex < row.length; colIndex++) {
				const cell = (row[colIndex] ?? '').trim();
				if (isPathLike(cell)) {
					paths.push({
						value: cell,
						type: classifyPathType(cell),
						position: {
							line: rowIndex + 1,
							column: colIndex + 1,
						},
						context: `CSV cell [${rowIndex + 1},${colIndex + 1}]`,
					});
				}
			}
		}

		return paths;
	} catch (_error) {
		// Return empty array on parse error
		return [];
	}
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
