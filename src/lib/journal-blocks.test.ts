import { describe, expect, it } from 'vitest';
import { BLOCK_LIMITS, BlockError, flattenBlocks, parseStoredBlocks, validateBlocks } from './journal-blocks';

describe('journal blocks', () => {
	it('accepts every block type, keeps only known fields, and trims headings', () => {
		const out = validateBlocks([
			{ type: 'heading', level: 2, text: '  Teza  ', evil: '<script>' },
			{ type: 'text', md: 'Akapit **pogrubiony**.' },
			{ type: 'columns', columns: [[{ type: 'text', md: 'Lewa' }], [{ type: 'quote', sourceId: 3 }, { type: 'separator' }]] },
			{ type: 'callout', md: 'Wniosek.' }
		]);
		expect(out[0]).toEqual({ type: 'heading', level: 2, text: 'Teza' });
		expect(out[2]).toEqual({ type: 'columns', columns: [[{ type: 'text', md: 'Lewa' }], [{ type: 'quote', sourceId: 3 }, { type: 'separator' }]] });
	});

	it('refuses malformed input with a message naming the place', () => {
		const bad: [unknown, RegExp][] = [
			['nope', /list/],
			[[{ type: 'video' }], /unknown block type "video"/],
			[[{ type: 'heading', level: 1, text: 'x' }], /level/],
			[[{ type: 'heading', level: 2, text: '   ' }], /empty/],
			[[{ type: 'quote', sourceId: -1 }], /source/],
			[[{ type: 'text', md: 42 }], /must be text/],
			[[{ type: 'columns', columns: [[{ type: 'text', md: 'a' }]] }], /2 or 3/],
			[[{ type: 'columns', columns: [[], [], [], []] }], /2 or 3/],
			[[{ type: 'columns', columns: [[{ type: 'columns', columns: [[], []] }], []] }], /inside columns/],
			[[{ type: 'text', md: 'x'.repeat(BLOCK_LIMITS.mdChars + 1) }], /longer than/],
			[[{ type: 'separator' }], /empty/],
			[[{ type: 'text', md: '   ' }], /empty/],
			[Array.from({ length: BLOCK_LIMITS.blocks + 1 }, () => ({ type: 'text', md: 'a' })), /at most/]
		];
		for (const [input, msg] of bad) expect(() => validateBlocks(input), String(msg)).toThrow(msg);
		expect(() => validateBlocks([{ type: 'video' }])).toThrow(BlockError);
	});

	it('flattens to Markdown for search and citation checks, quotations included', () => {
		const md = flattenBlocks(
			validateBlocks([
				{ type: 'heading', level: 3, text: 'Część I' },
				{ type: 'columns', columns: [[{ type: 'text', md: 'A [[src:1]]' }], [{ type: 'quote', sourceId: 2 }]] },
				{ type: 'separator' }
			])
		);
		expect(md).toBe('### Część I\n\nA [[src:1]]\n\n[[quote:2]]\n\n---');
	});

	it('falls back to the Markdown body when stored blocks are missing or broken', () => {
		expect(parseStoredBlocks(null, 'Stary tekst')).toEqual([{ type: 'text', md: 'Stary tekst' }]);
		expect(parseStoredBlocks('{broken', 'Stary tekst')).toEqual([{ type: 'text', md: 'Stary tekst' }]);
		expect(parseStoredBlocks('[{"type":"text","md":"Nowy"}]', 'Stary')).toEqual([{ type: 'text', md: 'Nowy' }]);
	});
});
