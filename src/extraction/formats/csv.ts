import { parse } from 'csv-parse/sync';
import type { Path } from '../../types';
import { classifyPathType, isPathLike } from '../heuristics';

/**
 * The byte between cells, and the name the context line goes by.
 *
 * Tab-separated files are the same grammar with a different delimiter,
 * and reading one on commas made every row a single cell — never
 * path-like, so the document reported nothing at all. Held equal to the
 * crate's `COMMA`/`TAB` by the shared corpus.
 */
export const COMMA = ',';
export const TAB = '\t';

/**
 * Extract path-like cells from CSV.
 * Positions are cell coordinates — line is the row number, column is
 * the cell index (not a character offset); the context repeats both.
 */
export function extractFromCsv(
	content: string,
	delimiter: string = COMMA,
): readonly Path[] {
	if (content.trim().length === 0) return [];
	const label = delimiter === TAB ? 'TSV' : 'CSV';

	try {
		const rows = parse(content, {
			columns: false,
			delimiter,
			bom: true,
			skip_empty_lines: true,
			relax_quotes: true,
			relax_column_count: true,
			trim: true,
			// csv-parse's sync parse is typed `any`; with `columns: false` it
			// yields rows of cells, which is what one cast states directly.
		}) as string[][];

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
						context: `${label} cell [${rowIndex + 1},${colIndex + 1}]`,
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
