import type { Path } from '../../types';
import { classifyPathType } from '../heuristics';
import { createPositionIndex } from '../position';
import { isExcludedScheme } from './schemes';

/**
 * Extract paths from HTML attributes (src, href, srcset, action, …).
 * Whole-content matching, so attributes inside multi-line tags are
 * found; columns point at the attribute value, and each srcset entry
 * gets its own real position.
 */

const ATTRIBUTE_PATTERN =
	/\b(src|href|data|action|poster|background|cite|formaction|icon|manifest|srcset)\s*=\s*(["'])([^"']+)\2/dgi;

export function extractFromHtml(content: string): readonly Path[] {
	if (content.trim().length === 0) return [];

	const toPosition = createPositionIndex(content);
	const paths: Path[] = [];

	ATTRIBUTE_PATTERN.lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = ATTRIBUTE_PATTERN.exec(content)) !== null) {
		const attrName = match[1]?.toLowerCase();
		const attrValue = match[3];
		const indices = match.indices?.[3];
		if (!attrName || !attrValue || !indices) continue;

		const valueOffset = indices[0];

		if (attrName === 'srcset') {
			extractFromSrcset(attrValue, valueOffset, paths, toPosition);
			continue;
		}

		if (isExcludedScheme(attrValue)) continue;

		paths.push({
			value: attrValue,
			type: classifyPathType(attrValue),
			position: toPosition(valueOffset),
			context: `HTML ${attrName}`,
		});
	}

	return paths;
}

/**
 * srcset holds multiple URLs with descriptors:
 * "image1.jpg 1x, image2.jpg 2x". Each entry's offset is computed
 * within the attribute value so every URL gets its own position.
 */
function extractFromSrcset(
	srcset: string,
	baseOffset: number,
	paths: Path[],
	toPosition: (offset: number) => { line: number; column: number },
): void {
	let cursor = 0;
	for (const entry of srcset.split(',')) {
		const trimmedStart = cursor + (entry.length - entry.trimStart().length);
		const url = entry.trim().split(/\s+/)[0];
		if (url && !isExcludedScheme(url)) {
			paths.push({
				value: url,
				type: classifyPathType(url),
				position: toPosition(baseOffset + trimmedStart),
				context: 'HTML srcset',
			});
		}
		cursor += entry.length + 1; // +1 for the comma
	}
}
