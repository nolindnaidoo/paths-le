import { parse } from 'csv-parse/sync';
import type { Path } from '../../types';
import { classifyPathType, isPathLike } from '../heuristics';

/**
 * Extract path-like cells from CSV.
 * Positions are cell coordinates — line is the row number, column is
 * the cell index (not a character offset); the context repeats both.
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
