import { describe, expect, it } from 'vitest';
import { isEmptyBlock, move, newBlock, setColumnCount, toJson, withKeys, type EditorColumns } from './block-utils';

describe('block editor helpers', () => {
	it('adds keys for the editor and strips them for saving', () => {
		const blocks = withKeys([{ type: 'text', md: 'a' }, { type: 'columns', columns: [[{ type: 'separator' }], []] }]);
		expect(blocks.every((b) => b._k)).toBe(true);
		expect(JSON.parse(toJson(blocks))).toEqual([{ type: 'text', md: 'a' }, { type: 'columns', columns: [[{ type: 'separator' }], []] }]);
	});

	it('moves blocks within bounds only', () => {
		const l = ['a', 'b', 'c'];
		move(l, 0, 1);
		expect(l).toEqual(['b', 'a', 'c']);
		move(l, 0, -1);
		move(l, 2, 3);
		expect(l).toEqual(['b', 'a', 'c']);
	});

	it('changes the column count without losing blocks', () => {
		const c = newBlock('columns') as EditorColumns;
		setColumnCount(c, 3);
		expect(c.columns).toHaveLength(3);
		c.columns[2][0] = { type: 'text', md: 'ważne', _k: 'x' };
		setColumnCount(c, 2);
		expect(c.columns).toHaveLength(2);
		expect(c.columns[1].map((b) => ('md' in b ? b.md : ''))).toContain('ważne');
	});

	it('knows when a block holds nothing worth confirming before deletion', () => {
		expect(isEmptyBlock(newBlock('text'))).toBe(true);
		expect(isEmptyBlock({ type: 'heading', level: 2, text: 'X', _k: 'k' })).toBe(false);
		expect(isEmptyBlock(newBlock('columns'))).toBe(true);
	});
});
