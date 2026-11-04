import { describe, expect, it } from 'vitest';
import { human } from './review';
import { createMedia, setMediaStatus } from './media';
import { findMediaProblems, renderMedia } from './journal-media';
import { approveText, createArticle } from './journal';
import { renderBlocks } from './journal-render';

const ania = human('ania');
let n = 0;
const yt = (approved = true) => {
	const id = createMedia({ title: `Rota ${++n}`, artist_or_author: 'Chór', media_type: 'music', url: `https://youtu.be/${'A'.repeat(9)}${String(n).padStart(2, '0')}` }, ania);
	if (approved) setMediaStatus(id, 'human_approved', ania);
	return id;
};
const link = () => {
	const id = createMedia({ title: 'Neutralność Szwajcarii', artist_or_author: 'admin.ch', media_type: 'article', url: `https://www.admin.ch/n-${++n}`, as_link: true, public_note: 'Oficjalne ujęcie.' }, ania);
	setMediaStatus(id, 'human_approved', ania);
	return id;
};

describe('journal media', () => {
	it('turns an approved YouTube item into a click-to-load player on the privacy host', () => {
		const r = renderMedia({ mediaId: yt(), caption: 'Hymn' });
		expect(r).toMatchObject({ type: 'embed', provider: 'youtube', caption: 'Hymn' });
		expect((r as { embed_url: string }).embed_url).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?autoplay=1$/);
	});

	it('turns an approved Biblioteka link into a link card with the editor note', () => {
		expect(renderMedia({ mediaId: link() })).toMatchObject({ type: 'linkcard', title: 'Neutralność Szwajcarii', note: 'Oficjalne ujęcie.', media_type: 'article' });
	});

	it('shows nothing for unapproved or missing items, and blocks approval of an article using them', () => {
		const draft = yt(false);
		expect(renderMedia({ mediaId: draft })).toBeNull();
		expect(findMediaProblems([{ type: 'media', mediaId: draft }, { type: 'columns', columns: [[{ type: 'media', mediaId: 999999 }], []] }])).toEqual([
			expect.stringMatching(/not approved/),
			expect.stringMatching(/no longer exists/)
		]);
		const a = createArticle({ caliber: 'light', locale: 'pl', title: 'Z nagraniem', blocks: [{ type: 'text', md: 'x' }, { type: 'media', mediaId: draft }] }, ania);
		expect(() => approveText(a, 'pl', ania)).toThrow(/media .* not approved/);
	});

	it('renders inside articles and columns', () => {
		const { blocks } = renderBlocks([{ type: 'media', mediaId: yt() }, { type: 'columns', columns: [[{ type: 'media', mediaId: link() }], [{ type: 'text', md: 'x' }]] }], 'pl');
		expect(blocks[0]).toMatchObject({ type: 'embed' });
		expect((blocks[1] as { columns: { type: string }[][] }).columns[0][0]).toMatchObject({ type: 'linkcard' });
	});
});
