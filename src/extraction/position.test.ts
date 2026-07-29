import { describe, expect, it } from 'vitest';
import { createPositionIndex } from './position';

describe('createPositionIndex', () => {
	it('maps offsets in a single-line document', () => {
		const at = createPositionIndex('hello world');
		expect(at(0)).toEqual({ line: 1, column: 1 });
		expect(at(6)).toEqual({ line: 1, column: 7 });
	});

	it('maps offsets across lines', () => {
		const content = 'ab\ncdef\n\nxyz';
		const at = createPositionIndex(content);
		expect(at(0)).toEqual({ line: 1, column: 1 });
		expect(at(3)).toEqual({ line: 2, column: 1 });
		expect(at(6)).toEqual({ line: 2, column: 4 });
		expect(at(8)).toEqual({ line: 3, column: 1 });
		expect(at(9)).toEqual({ line: 4, column: 1 });
		expect(at(11)).toEqual({ line: 4, column: 3 });
	});

	it('clamps out-of-range offsets', () => {
		const at = createPositionIndex('ab\ncd');
		expect(at(-5)).toEqual({ line: 1, column: 1 });
		expect(at(999)).toEqual({ line: 2, column: 3 });
	});

	it('handles empty content', () => {
		const at = createPositionIndex('');
		expect(at(0)).toEqual({ line: 1, column: 1 });
	});

	it('offset of a newline belongs to the line it terminates', () => {
		const at = createPositionIndex('ab\ncd');
		expect(at(2)).toEqual({ line: 1, column: 3 });
	});
});
