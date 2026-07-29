import { type Node, parseTree } from 'jsonc-parser';
import type { Path } from '../../types';
import { classifyPathType, isPathLike } from '../heuristics';
import { createPositionIndex, type PositionIndex } from '../position';

/**
 * Extract paths from JSON/JSONC string values.
 * jsonc-parser provides real node offsets (v1.x reported every path at
 * 1:1) and tolerates comments and trailing commas, so .jsonc documents
 * extract instead of silently returning nothing.
 */
export function extractFromJson(content: string): Path[] {
	if (content.trim().length === 0) return [];

	const root = parseTree(content, undefined, {
		allowTrailingComma: true,
		disallowComments: false,
	});
	if (!root) return [];

	const toPosition = createPositionIndex(content);
	const paths: Path[] = [];
	visitNode(root, [], paths, toPosition);
	return paths;
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
