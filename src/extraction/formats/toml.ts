import { parse } from '@iarna/toml';
import type { Extracted, Path } from '../../types';
import { classifyPathType, isPathLike } from '../heuristics';
import { createPositionIndex, type PositionIndex } from '../position';
import { nestsTooDeep, tooDeep } from './nesting';

/**
 * Extract paths from TOML values (and keys that look like paths).
 * @iarna/toml does not expose source offsets, so positions come from a
 * forward-moving locate over the source text: exact match first, then
 * the backslash-escaped form for Windows paths inside basic strings.
 * Repeated identical values resolve to successive occurrences; a value
 * that cannot be located falls back to 1:1.
 *
 * A document that does not parse is refused and named, never read as empty:
 * an empty list is what a clean document answers, and a document holding
 * `/etc/passwd` behind a broken line read as clean. The crate refuses with
 * the same words.
 */
export function extractFromToml(content: string): Extracted {
	if (content.trim().length === 0) return { paths: [] };
	if (nestsTooDeep(content, 'TOML')) return { refusal: tooDeep('TOML') };

	let parsed: unknown;
	try {
		parsed = parse(content);
	} catch (_error) {
		return { refusal: 'Invalid TOML: the document does not parse' };
	}

	const locator = createLocator(content);
	const paths: Path[] = [];
	walk(parsed, paths, locator);
	return { paths };
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
