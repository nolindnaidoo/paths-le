/**
 * Offset → line/column conversion for whole-content extraction.
 * Lines and columns are 1-based, matching the Path position contract.
 */
export interface TextPosition {
	readonly line: number;
	readonly column: number;
}

export type PositionIndex = (offset: number) => TextPosition;

export function createPositionIndex(content: string): PositionIndex {
	// lineStarts[i] = offset of the first character of line i (0-based line)
	const lineStarts: number[] = [0];
	for (let i = 0; i < content.length; i++) {
		if (content.charCodeAt(i) === 10 /* \n */) {
			lineStarts.push(i + 1);
		}
	}

	return (offset: number): TextPosition => {
		const clamped = Math.max(0, Math.min(offset, content.length));

		let low = 0;
		let high = lineStarts.length - 1;
		while (low < high) {
			const mid = (low + high + 1) >> 1;
			const start = lineStarts[mid];
			if (start !== undefined && start <= clamped) {
				low = mid;
				continue;
			}
			high = mid - 1;
		}

		const lineStart = lineStarts[low] ?? 0;
		return Object.freeze({
			line: low + 1,
			column: clamped - lineStart + 1,
		});
	};
}
