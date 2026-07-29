import type { Path } from '../../types';
import { classifyPathType } from '../heuristics';
import { createPositionIndex } from '../position';

/**
 * Extract module paths from JavaScript/TypeScript source.
 * Whole-content regex (not per-line), so multi-line import/export
 * statements are matched. Only module specifiers are extracted —
 * import/export…from, side-effect imports, dynamic import(), require()
 * — and package names ('react', '@org/pkg') are filtered out.
 */

interface PatternSpec {
	readonly pattern: RegExp;
	readonly context: (match: RegExpExecArray) => string;
}

const PATTERNS: readonly PatternSpec[] = [
	{
		// import/export … from '…' — the statement head may span lines;
		// [^;'"`]*? cannot cross a string or statement boundary.
		pattern: /\b(import|export)\b[^;'"`]*?\bfrom\s*(['"])([^'"\n]+)\2/dg,
		context: (match) => `JS ${match[1]}`,
	},
	{
		pattern: /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/dg,
		context: () => 'JS dynamic import',
	},
	{
		pattern: /\brequire\s*\(\s*(['"])([^'"\n]+)\1\s*\)/dg,
		context: () => 'JS require',
	},
	{
		// side-effect import: import './x'
		pattern: /\bimport\s*(['"])([^'"\n]+)\1/dg,
		context: () => 'JS import',
	},
];

export function extractFromJavaScript(content: string): Path[] {
	if (content.trim().length === 0) return [];

	const toPosition = createPositionIndex(content);
	const paths: Path[] = [];
	const seenOffsets = new Set<number>();

	for (const { pattern, context } of PATTERNS) {
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = pattern.exec(content)) !== null) {
			// The path is always the last capture group.
			const groupIndex = match.length - 1;
			const value = match[groupIndex];
			const indices = match.indices?.[groupIndex];
			if (!value || !indices || !isModulePath(value)) continue;

			const [start] = indices;
			if (seenOffsets.has(start)) continue;
			seenOffsets.add(start);

			paths.push({
				value,
				type: classifyPathType(value),
				position: toPosition(start),
				context: context(match),
			});
		}
	}

	return paths.sort(
		(a, b) =>
			a.position.line - b.position.line ||
			a.position.column - b.position.column,
	);
}

/**
 * Module specifiers that are file paths (not package names):
 * relative, absolute, drive-letter, or URL.
 */
function isModulePath(value: string): boolean {
	if (value.length < 2) return false;
	if (value.startsWith('./') || value.startsWith('../')) return true;
	if (value.startsWith('/')) return true;
	if (/^[A-Za-z]:[/\\]/.test(value)) return true;
	if (value.startsWith('http://') || value.startsWith('https://')) return true;
	if (value.startsWith('file://')) return true;
	return false;
}
