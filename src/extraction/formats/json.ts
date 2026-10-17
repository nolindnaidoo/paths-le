import { JsoncError, type JsonValue, parseJsonc } from '../../parsers/jsonc';
import type { Extracted, Path } from '../../types';
import { classifyPathType, isPathLike } from '../heuristics';
import { createPositionIndex, type PositionIndex } from '../position';
import { nestsTooDeep, tooDeep } from './nesting';

/**
 * Extract paths from JSON/JSONC string values.
 * jsonc-parser provides real node offsets (v1.x reported every path at
 * 1:1) and tolerates comments and trailing commas, so .jsonc documents
 * extract instead of silently returning nothing.
 *
 * A document that does not parse is refused and named. It used to be read
 * as empty, which is also what a clean document answers, so a file holding
 * `/etc/passwd` behind a syntax error read as clean. And jsonc-parser
 * recovers a partial tree from a document cut off mid-value, so reading
 * paths out of whatever it built answered one path where the crate's parser
 * answered none. The errors it collects are the signal, whatever tree it
 * also built; the crate refuses the same documents with the same words.
 */
export function extractFromJson(content: string): Extracted {
	if (content.trim().length === 0) return { paths: [] };
	if (nestsTooDeep(content, 'JSON')) return { refusal: tooDeep('JSON') };

	// jsonc-parser 0.33 with comments and trailing commas, as the crate reads
	// it: a document of comments alone has no value, and is empty.
	let root: JsonValue | undefined;
	try {
		root = parseJsonc(content, true);
	} catch (error) {
		if (!(error instanceof JsoncError)) throw error;
		return { refusal: 'Invalid JSON: the document does not parse' };
	}
	if (root === undefined) return { paths: [] };

	const toPosition = createPositionIndex(content);
	const paths: Path[] = [];
	visitNode(root, [], paths, toPosition);
	return { paths };
}

function visitNode(
	node: JsonValue,
	keyPath: string[],
	paths: Path[],
	toPosition: PositionIndex,
): void {
	if (node.type === 'string') {
		const value = node.value;
		if (isPathLike(value)) {
			paths.push({
				value,
				type: classifyPathType(value),
				// +1 skips the opening quote so the position points at the path
				position: toPosition(node.start + 1),
				context: `JSON ${keyPath.length > 0 ? keyPath.join('.') : 'value'}`,
			});
		}
		return;
	}

	if (node.type === 'array') {
		node.elements.forEach((child, index) => {
			visitNode(child, [...keyPath, `[${index}]`], paths, toPosition);
		});
		return;
	}

	if (node.type === 'object') {
		for (const property of node.properties) {
			visitNode(property.value, [...keyPath, property.name], paths, toPosition);
		}
	}
}
