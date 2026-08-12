import * as yaml from 'js-yaml';
import type { Path } from '../../types';
import { classifyPathType, isPathLike } from '../heuristics';
import { createPositionIndex, type PositionIndex } from '../position';

/**
 * Extract paths from YAML scalars (and keys that look like paths).
 *
 * js-yaml exposes no source offsets for values, so positions come from a
 * forward-moving locate over the source text — exactly as TOML's do. Repeated
 * identical values resolve to successive occurrences; a value that cannot be
 * located falls back to 1:1.
 *
 * That is also what keeps this equal to the Rust CLI, which reads YAML with
 * `saphyr`. The two parsers only have to agree on the *values* and their order;
 * a position taken from either parser's own markers would disagree on every
 * quoted, folded or anchored scalar.
 *
 * Keys count as well as values, because a YAML mapping keyed by path is
 * ordinary — a Kubernetes config map's `data:`, a compose file's volumes. TOML
 * does the same for the same reason.
 */
export function extractFromYaml(content: string): readonly Path[] {
	let documents: readonly unknown[];
	try {
		// loadAll handles both a single document and a `---`-separated stream;
		// load() rejects the latter outright.
		documents = yaml.loadAll(content);
	} catch (_error) {
		// A document that does not parse yields nothing, matching TOML and
		// JSON here — a broken document reads the same way whatever it is.
		return [];
	}

	const locate = createLocator(content);
	const paths: Path[] = [];
	for (const document of documents) {
		walk(document, paths, locate);
	}
	return paths;
}

function walk(
	node: unknown,
	paths: Path[],
	locate: (value: string) => { line: number; column: number },
): void {
	if (typeof node === 'string') {
		claim(node, 'YAML value', paths, locate);
		return;
	}

	if (Array.isArray(node)) {
		for (const item of node) {
			walk(item, paths, locate);
		}
		return;
	}

	// Numbers, booleans, nulls and dates are not strings, so there is no path
	// in them.
	if (!node || typeof node !== 'object') return;

	for (const [key, value] of Object.entries(node)) {
		claim(key, 'YAML key', paths, locate);
		walk(value, paths, locate);
	}
}

function claim(
	text: string,
	context: string,
	paths: Path[],
	locate: (value: string) => { line: number; column: number },
): void {
	if (!isPathLike(text)) return;
	paths.push({
		value: text,
		type: classifyPathType(text),
		position: locate(text),
		context,
	});
}

function createLocator(
	content: string,
): (value: string) => { line: number; column: number } {
	const toPosition: PositionIndex = createPositionIndex(content);
	let searchFrom = 0;

	return (value: string) => {
		const at = content.indexOf(value, searchFrom);
		if (at !== -1) {
			searchFrom = at + value.length;
			return toPosition(at);
		}
		// An anchor's value is expanded at every alias, so the same string
		// legitimately appears behind the cursor. Retrying from the top answers
		// with the definition rather than with 1:1.
		const anywhere = content.indexOf(value);
		if (anywhere !== -1) {
			return toPosition(anywhere);
		}
		return { line: 1, column: 1 };
	};
}
