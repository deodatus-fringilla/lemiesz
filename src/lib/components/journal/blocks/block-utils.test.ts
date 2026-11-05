import { describe, expect, it } from 'vitest';
import { isEmptyBlock, move, newBlock, toJson, withKeys } from './block-utils';

describe('block editor helpers', () => {
	it('adds keys for the editor and strips them for saving', () => {
		const blocks = withKeys([{ type: 'text', md: 'a' }, { type: 'separator' }]);
		expect(blocks.every((b) => b._k)).toBe(true);
		expect(JSON.parse(toJson(blocks))).toEqual([{ type: 'text', md: 'a' }, { type: 'separator' }]);
	});

	it('moves blocks within bounds only', () => {
		const l = ['a', 'b', 'c'];
		move(l, 0, 1);
		expect(l).toEqual(['b', 'a', 'c']);
		move(l, 0, -1);
		move(l, 2, 3);
		expect(l).toEqual(['b', 'a', 'c']);
	});

	it('knows when a block holds nothing worth confirming before deletion', () => {
		expect(isEmptyBlock(newBlock('text'))).toBe(true);
		expect(isEmptyBlock({ type: 'heading', level: 2, text: 'X', _k: 'k' })).toBe(false);
	});
});
