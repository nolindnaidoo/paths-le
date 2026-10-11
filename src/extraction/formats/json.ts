import {
	type Node,
	type ParseError,
	ParseErrorCode,
	parseTree,
	stripComments,
} from 'jsonc-parser';
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

	const errors: ParseError[] = [];
	const root = parseTree(content, errors, {
		allowTrailingComma: true,
		disallowComments: false,
	});
	// Comments and nothing else is a document with no value in it, not a
	// broken one: the crate's parser answers "no value" and this one reports
	// the value it expected. Both read it as empty. A stray `}` also reports
	// a value expected, so the text has to be comments and whitespace as well;
	// an unterminated comment reports more than that and stays refused.
	if (
		!root &&
		stripComments(content).trim().length === 0 &&
		errors.every((e) => e.error === ParseErrorCode.ValueExpected)
	) {
		return { paths: [] };
	}
	if (errors.length > 0) {
		return { refusal: 'Invalid JSON: the document does not parse' };
	}
	if (!root) return { paths: [] };

	const toPosition = createPositionIndex(content);
	const paths: Path[] = [];
	visitNode(root, [], paths, toPosition);
	return { paths };
}

function visitNode(
	node: Node,
	keyPath: string[],
	paths: Path[],
	toPosition: PositionIndex,
): void {
	if (node.type === 'string' && typeof node.value === 'string') {
		const value = node.value;
		if (isPathLike(value)) {
			paths.push({
				value,
				type: classifyPathType(value),
				// +1 skips the opening quote so the position points at the path
				position: toPosition(node.offset + 1),
				context: `JSON ${keyPath.length > 0 ? keyPath.join('.') : 'value'}`,
			});
		}
		return;
	}

	if (node.type === 'array') {
		node.children?.forEach((child, index) => {
			visitNode(child, [...keyPath, `[${index}]`], paths, toPosition);
		});
		return;
	}

	if (node.type === 'object') {
		for (const property of node.children ?? []) {
			const [keyNode, valueNode] = property.children ?? [];
			if (!keyNode || !valueNode) continue;
			const key = typeof keyNode.value === 'string' ? keyNode.value : '';
			visitNode(valueNode, [...keyPath, key], paths, toPosition);
		}
	}
}
