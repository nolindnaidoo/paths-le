import type { Path } from '../../types';
import { classifyPathType } from '../heuristics';
import { createPositionIndex } from '../position';
import { isExcludedScheme } from './schemes';

/**
 * Extract url() and @import paths from CSS/SCSS/LESS.
 * Whole-content matching; columns point at the path itself. @import
 * matches are recorded first and their url() spans skipped so a path is
 * never double-counted.
 */

const IMPORT_PATTERN =
	/@import\s+(?:url\s*\(\s*)?(['"])([^'"]+)\1(?:\s*\))?/dgi;
const URL_PATTERN = /url\s*\(\s*(['"]?)([^'"()]+?)\1\s*\)/dgi;

export function extractFromCss(content: string): Path[] {
	if (content.trim().length === 0) return [];

	const toPosition = createPositionIndex(content);
	const paths: Path[] = [];
	const claimed = new Set<number>();

	IMPORT_PATTERN.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = IMPORT_PATTERN.exec(content)) !== null) {
		const value = match[2]?.trim();
		const indices = match.indices?.[2];
		if (!value || !indices || isExcludedScheme(value)) continue;
		claimed.add(indices[0]);
		paths.push({
			value,
			type: classifyPathType(value),
			position: toPosition(indices[0]),
			context: 'CSS @import',
		});
	}

	URL_PATTERN.lastIndex = 0;
	while ((match = URL_PATTERN.exec(content)) !== null) {
		const value = match[2]?.trim();
		const indices = match.indices?.[2];
		if (!value || !indices || isExcludedScheme(value)) continue;
		if (claimed.has(indices[0])) continue;
		paths.push({
			value,
			type: classifyPathType(value),
			position: toPosition(indices[0]),
			context: 'CSS url()',
		});
	}

	return paths.sort(
		(a, b) =>
			a.position.line - b.position.line ||
			a.position.column - b.position.column,
	);
}
