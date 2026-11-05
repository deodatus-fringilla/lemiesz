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

describe('media blocks', () => {
	it('validate the item and keep an optional caption', () => {
		expect(validateBlocks([{ type: 'media', mediaId: 4, caption: ' Hymn ' }])).toEqual([{ type: 'media', mediaId: 4, caption: 'Hymn' }]);
		expect(() => validateBlocks([{ type: 'media', mediaId: 0 }])).toThrow(/library/);
		expect(flattenBlocks([{ type: 'media', mediaId: 4, caption: 'Hymn' }])).toBe('Hymn');
	});
});

describe('images written into text by the article editor', () => {
	it('reads each image line: address, caption (unescaped) and floating', async () => {
		const { inlineImages } = await import('./journal-blocks');
		const md = 'Tekst.\n\n![Opis](/images/a.webp "Podpis \\"cytat\\"")\n\n![x](/images/b.webp){.left}\n\n![y](/images/c.webp "C"){.right}\n\n![z](/images/d.webp){.full}';
		expect(inlineImages(md)).toEqual([
			{ src: '/images/a.webp', caption: 'Podpis "cytat"' },
			{ src: '/images/b.webp', caption: '', place: 'left' },
			{ src: '/images/c.webp', caption: 'C', place: 'right' },
			{ src: '/images/d.webp', caption: '' } // "full" is not a position here: Lemiesz has its own wide image blocks
		]);
	});

	it('only a line of its own counts; an image in the middle of a sentence is not one', async () => {
		const { inlineImages } = await import('./journal-blocks');
		expect(inlineImages('Zobacz ![x](/images/a.webp) tutaj.')).toEqual([]);
		expect(inlineImages('> ![x](/images/q.webp "w cytacie")')).toEqual([{ src: '/images/q.webp', caption: 'w cytacie' }]);
	});

	it('finds them in text and highlight blocks, columns included', async () => {
		const { inlineImagesOf } = await import('./journal-blocks');
		const found = inlineImagesOf([
			{ type: 'text', md: '![a](/images/1.webp)' },
			{ type: 'columns', columns: [[{ type: 'callout', md: '![b](/images/2.webp)' }], [{ type: 'heading', level: 2, text: '![c](/images/3.webp)' }]] }
		]);
		expect(found.map((i) => i.src)).toEqual(['/images/1.webp', '/images/2.webp']);
	});

	it('leaves only the caption in the article body that search and the feed use', async () => {
		const { flattenBlocks } = await import('./journal-blocks');
		const body = flattenBlocks([{ type: 'text', md: 'Przed.\n\n![Opis](/images/a.webp "Jeż pod dębem"){.left}\n\nPo.' }]);
		expect(body).toBe('Przed.\n\nJeż pod dębem\n\nPo.');
		expect(body).not.toContain('/images/');
	});
});
