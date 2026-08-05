import { parse } from '@iarna/toml';
import type { Path } from '../../types';
import { classifyPathType, isPathLike } from '../heuristics';
import { createPositionIndex, type PositionIndex } from '../position';

/**
 * Extract paths from TOML values (and keys that look like paths).
 * @iarna/toml does not expose source offsets, so positions come from a
 * forward-moving locate over the source text: exact match first, then
 * the backslash-escaped form for Windows paths inside basic strings.
 * Repeated identical values resolve to successive occurrences; a value
 * that cannot be located falls back to 1:1.
 */
export function extractFromToml(content: string): readonly Path[] {
	if (content.trim().length === 0) return [];

	let parsed: unknown;
	try {
		parsed = parse(content);
	} catch (_error) {
		return [];
	}

	const locator = createLocator(content);
	const paths: Path[] = [];
	walk(parsed, paths, locator);
	return paths;
}

function walk(
	obj: unknown,
	paths: Path[],
	locate: (value: string) => { line: number; column: number },
): void {
	if (typeof obj === 'string') {
		if (isPathLike(obj)) {
			paths.push({
				value: obj,
				type: classifyPathType(obj),
				position: locate(obj),
				context: 'TOML value',
			});
		}
		return;
	}

	if (Array.isArray(obj)) {
		for (const item of obj) {
			walk(item, paths, locate);
		}
		return;
	}

	if (obj && typeof obj === 'object') {
		for (const [key, value] of Object.entries(obj)) {
			if (isPathLike(key)) {
				paths.push({
					value: key,
					type: classifyPathType(key),
					position: locate(key),
					context: 'TOML key',
				});
			}
			walk(value, paths, locate);
		}
	}
}

function createLocator(
	content: string,
): (value: string) => { line: number; column: number } {
	const toPosition: PositionIndex = createPositionIndex(content);
	let searchFrom = 0;

	return (value: string) => {
		const candidates = [value, value.replaceAll('\\', '\\\\')];
		for (const candidate of candidates) {
			const at = content.indexOf(candidate, searchFrom);
			if (at !== -1) {
				searchFrom = at + candidate.length;
				return toPosition(at);
			}
			// Occurrences can appear before the cursor when table order
			// differs from source order — retry from the top.
			const anywhere = content.indexOf(candidate);
			if (anywhere !== -1) {
				return toPosition(anywhere);
			}
		}
		return { line: 1, column: 1 };
	};
}
