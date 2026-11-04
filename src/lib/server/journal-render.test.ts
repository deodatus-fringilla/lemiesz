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
