import { loadToml, type TomlValue } from '../../parsers/toml/load';
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

	// toml 1.1 at preserve_order, as the crate reads it.
	const parsed = loadToml(content);
	if (typeof parsed === 'string') {
		return { refusal: 'Invalid TOML: the document does not parse' };
	}

	const locator = createLocator(content);
	const paths: Path[] = [];
	walk(parsed, paths, locator);
	return { paths };
}

function walk(
	value: TomlValue,
	paths: Path[],
	locate: (value: string) => { line: number; column: number },
): void {
	if (value.type === 'string') {
		if (isPathLike(value.text)) {
			paths.push({
				value: value.text,
				type: classifyPathType(value.text),
				position: locate(value.text),
				context: 'TOML value',
			});
		}
		return;
	}
	if (value.type === 'array') {
		for (const item of value.items) walk(item, paths, locate);
		return;
	}
	if (value.type !== 'table') return;
	for (const [key, item] of value.entries) {
		if (isPathLike(key)) {
			paths.push({
				value: key,
				type: classifyPathType(key),
				position: locate(key),
				context: 'TOML key',
			});
		}
		walk(item, paths, locate);
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
