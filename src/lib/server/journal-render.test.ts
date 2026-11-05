import { describe, expect, it } from 'vitest';
import { db } from './db';
import { renderArticle } from './journal-render';

function source(review = 'human_approved', locale = 'pl', text = 'Terytorium mocarstw neutralnych jest nietykalne.'): number {
	const id = Number(
		db.prepare("INSERT INTO sources (work, section_ref, category, license, original_locale, url) VALUES ('V Konwencja haska', 'Art. 1', 'law', 'public domain', 'pl', 'https://example.org/haga')").run()
			.lastInsertRowid
	);
	db.prepare('INSERT INTO source_texts (source_id, locale, text, origin, review) VALUES (?, ?, ?, ?, ?)').run(id, locale, text, 'original', review);
	return id;
}

describe('renderArticle', () => {
	it('renders Markdown and numbers footnotes by first appearance, reusing a number for a repeated source', () => {
		const a = source();
		const b = source();
		const { html, notes } = renderArticle(`## Teza\n\nPierwsze [[src:${b}]], drugie [[src:${a}]], znów [[src:${b}]].`, 'pl');
		expect(html).toContain('<h2>Teza</h2>');
		expect(notes.map((n) => [n.n, n.sourceId])).toEqual([[1, b], [2, a]]);
		expect(html.match(/<sup class="fn">/g)).toHaveLength(3);
		expect(html).toContain('href="#przypis-1"');
		expect(notes[0]).toMatchObject({ work: 'V Konwencja haska', section_ref: 'Art. 1', url: 'https://example.org/haga' });
	});

	it('takes verbatim quotations from the database: a block on its own line, inline mid-sentence', () => {
		const id = source();
		const block = renderArticle(`Wstęp.\n\n[[quote:${id}]]\n\nDalej.`, 'pl').html;
		expect(block).toContain('<blockquote class="quote"><p>Terytorium mocarstw neutralnych jest nietykalne.</p>');
		const inline = renderArticle(`Konwencja mówi: [[quote:${id}]] i to wystarczy.`, 'pl').html;
		expect(inline).toContain('<q>Terytorium mocarstw neutralnych jest nietykalne.</q><sup class="fn">');
	});

	it('never shows a quotation whose text is not human-approved in this language (falls back to a footnote)', () => {
		const draft = source('draft');
		const other = source('human_approved', 'en', 'English only text.');
		const { html } = renderArticle(`A [[quote:${draft}]] B [[quote:${other}]]`, 'pl');
		expect(html).not.toContain('nietykalne');
		expect(html).not.toContain('English only');
		expect(html.match(/<sup class="fn">/g)).toHaveLength(2);
	});

	it('drops tokens for unknown sources instead of showing raw syntax', () => {
		const { html, notes } = renderArticle('Coś [[src:987654]] tu.', 'pl');
		expect(html).not.toContain('[[src');
		expect(html).not.toContain('LEMIESZCITE');
		expect(notes).toEqual([]);
	});

	it('neutralises raw HTML, script links and remote images', () => {
		const { html } = renderArticle(
			'<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[klik](javascript:alert(1)) [ok](https://neutralnosc.pl) ![obraz](https://tracker.example/p.png)',
			'pl'
		);
		// No real tag or attribute survives: what remains is escaped text such as "&lt;img … onerror=…&gt;".
		expect(html).not.toMatch(/<(script|img)\b/i);
		expect(html).not.toMatch(/<[a-z][^>]*\son\w+=/i); // an event handler inside a real tag
		expect(html).not.toMatch(/href="javascript:/i);
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('<a href="https://neutralnosc.pl" rel="noopener noreferrer nofollow" target="_blank">ok</a>');
		expect(html).toContain('>obraz</a>');
		expect(html).toContain('klik');
	});
});

describe('renderBlocks', () => {
	it('renders every block type and numbers footnotes across the whole article, columns included', async () => {
		const { renderBlocks } = await import('./journal-render');
		const a = source();
		const b = source();
		const { blocks, notes } = renderBlocks(
			[
				{ type: 'heading', level: 2, text: 'Teza <b>' },
				{ type: 'text', md: `Wstęp [[src:${a}]].` },
				{ type: 'columns', columns: [[{ type: 'text', md: `Lewa [[src:${b}]]` }], [{ type: 'quote', sourceId: a }, { type: 'separator' }]] },
				{ type: 'callout', md: `**Wniosek** [[src:${b}]] <script>x</script>` }
			],
			'pl'
		);
		expect(blocks[0]).toEqual({ type: 'heading', level: 2, text: 'Teza <b>' }); // plain text: the page escapes it
		expect(notes.map((n) => n.sourceId)).toEqual([a, b]); // a first, b second, repeats keep their number
		const cols = blocks[2] as { type: 'columns'; columns: { type: string; html?: string }[][] };
		expect(cols.columns[0][0].html).toContain('href="#przypis-2"');
		expect(cols.columns[1][0].html).toContain('<blockquote class="quote">');
		expect(cols.columns[1][1]).toEqual({ type: 'separator' });
		const callout = blocks[3] as { type: 'callout'; html: string };
		expect(callout.html).toContain('<strong>Wniosek</strong>');
		expect(callout.html).not.toMatch(/<script/i);
	});
});

describe('images inside columns', () => {
	it('are always as wide as their column, whatever size the editor chose', async () => {
		const { renderBlocks } = await import('./journal-render');
		const { createPoster, setPosterStatus } = await import('./posters');
		const { setImageMeta } = await import('./journal-images');
		const { human } = await import('./review');
		const id = createPoster({ title: 'K', artist_or_author: 'S', image_path: `/images/test/col-${Date.now()}.jpg` }, human('t'));
		setImageMeta(id, { alt_pl: 'opis' }, human('t'));
		setPosterStatus(id, 'human_approved', human('t'));
		const { blocks } = renderBlocks([{ type: 'columns', columns: [[{ type: 'image', imageId: id, size: 'full' }], [{ type: 'text', md: 'x' }]] }, { type: 'image', imageId: id, size: 'full' }], 'pl');
		const col = blocks[0] as { columns: { type: string; size?: string }[][] };
		expect(col.columns[0][0]).toMatchObject({ type: 'image', size: 'column' });
		expect(blocks[1]).toMatchObject({ type: 'image', size: 'full' }); // outside columns the choice stands
	});
});

describe('images written into text by the article editor', () => {
	async function library(over: { status?: 'draft' | 'human_approved'; alt?: string | null } = {}) {
		const { createPoster, setPosterStatus } = await import('./posters');
		const { setImageMeta, getJournalImage } = await import('./journal-images');
		const { human } = await import('./review');
		const id = createPoster({ title: 'Jeż', artist_or_author: 'Anna <Autor>', image_path: `/images/test/txt-${Math.random().toString(36).slice(2)}.jpg` }, human('t'));
		if (over.alt !== null) setImageMeta(id, { alt_pl: over.alt ?? 'Jeż pod dębem', license: 'CC BY 4.0' }, human('t'));
		if (over.status !== 'draft') setPosterStatus(id, 'human_approved', human('t'));
		return getJournalImage(id)!.src;
	}

	it('shows an approved library image as a figure, with the description, credit and licence of the library', async () => {
		const src = await library();
		const { html } = renderArticle(`Przed.\n\n![wymyślony opis](${src} "Podpis <b>")\n\nPo.`, 'pl');
		expect(html).toContain(`<figure class="img img-column"><img src="${src}" alt="Jeż pod dębem"`);
		expect(html).not.toContain('wymyślony opis'); // the description comes from the library, not from the text
		expect(html).toContain('<span>Podpis &lt;b&gt;</span>');
		expect(html).toContain('<span class="credit">Anna &lt;Autor&gt; · CC BY 4.0</span>');
		expect(html).not.toContain('<p></p>');
		expect(html.indexOf('Przed.')).toBeLessThan(html.indexOf('<figure'));
		expect(html.indexOf('<figure')).toBeLessThan(html.indexOf('Po.'));
	});

	it('floats an image to the left or right when asked, and uses the library caption when none is given', async () => {
		const src = await library();
		expect(renderArticle(`![x](${src}){.left}`, 'pl').html).toContain('class="img img-column img-left"');
		expect(renderArticle(`![x](${src}){.right}`, 'pl').html).toContain('class="img img-column img-right"');
		expect(renderArticle(`![x](${src}){.full}`, 'pl').html).toContain('class="img img-column"');
	});

	it('shows nothing for an image that is not approved, has no description in this language, or is not in the library', async () => {
		const draft = await library({ status: 'draft' });
		const noAlt = await library({ alt: null });
		for (const src of [draft, noAlt, '/images/nie-ma.webp', 'https://tracker.example/p.png']) {
			const { html } = renderArticle(`A.\n\n![x](${src})\n\nB.`, 'pl');
			expect(html).not.toMatch(/<(img|figure)\b/);
			expect(html).not.toContain('<p></p>');
			expect(html).not.toContain('LEMIESZ');
			expect(html).toContain('<p>A.</p>');
			expect(html).toContain('<p>B.</p>');
		}
		const ok = await library();
		expect(renderArticle(`![x](${ok})`, 'en').html).not.toContain('<figure'); // no English description yet
	});

	it('cannot be used to show a picture from anywhere but the library, or to inject markup', async () => {
		const ok = await library();
		const { html } = renderArticle(`![x](${ok} "\\"><script>alert(1)</script>")\n\n![y](javascript:alert(1))\n\n![z](/images/x.webp" onerror="alert(1))`, 'pl');
		expect(html).not.toMatch(/<script/i);
		expect(html).not.toMatch(/<[a-z][^>]*\son\w+=/i);
		expect(html).not.toContain('javascript:');
		expect((html.match(/<img\b/g) ?? []).length).toBe(1); // only the library picture
	});

	it('works inside a quotation and next to footnotes, and a caption never counts as a citation', async () => {
		const src = await library();
		const id = source();
		const { html, notes } = renderArticle(`> Cytat.\n>\n> ![x](${src} "Rys. 1")\n\nTekst [[src:${id}]].\n\n![y](${src} "pis [[src:999999]]")`, 'pl');
		expect(html).toMatch(/<blockquote>[\s\S]*<figure[\s\S]*<\/figure>[\s\S]*<\/blockquote>/);
		expect(notes.map((n) => n.sourceId)).toEqual([id]);
	});

	it('goes through renderBlocks like any other text, in a column too', async () => {
		const { renderBlocks } = await import('./journal-render');
		const src = await library();
		const { blocks } = renderBlocks([{ type: 'columns', columns: [[{ type: 'text', md: `![x](${src})` }], [{ type: 'text', md: 'x' }]] }], 'pl');
		const col = blocks[0] as { columns: { html?: string }[][] };
		expect(col.columns[0][0].html).toContain('<figure class="img img-column">');
	});
});
