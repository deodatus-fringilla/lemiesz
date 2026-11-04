import { Marked, type Tokens } from 'marked';
import { db } from '$lib/server/db';
import { citationIds } from '$lib/server/journal-citations';

/**
 * Turns a published article body (Markdown + [[src:ID]] / [[quote:ID]]) into safe HTML with numbered footnotes.
 * Safety: raw HTML in the Markdown is shown as text, only http(s)/mailto/#/relative links survive (and get
 * rel="noopener nofollow"), and images become plain links (the CSP allows local images only and readers'
 * privacy forbids third-party image loads). A verbatim quotation comes from the database, never from the body, and
 * only while its text is still human-approved in the article's language; otherwise it degrades to a footnote.
 */
export interface Footnote {
	n: number;
	sourceId: number;
	work: string;
	section_ref: string;
	url: string | null;
}

export const escapeHtml = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function safeHref(href: string): string | null {
	const h = href.trim();
	if (/^(https?:|mailto:)/i.test(h)) return h;
	if (/^[#/]/.test(h) && !h.startsWith('//')) return h;
	return null;
}

const markdown = new Marked({ gfm: true });
markdown.use({
	renderer: {
		html(token: Tokens.HTML | Tokens.Tag) {
			return escapeHtml(token.text);
		},
		link(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, token: Tokens.Link) {
			const text = this.parser.parseInline(token.tokens);
			const href = safeHref(token.href);
			if (!href) return text;
			const external = /^https?:/i.test(href);
			return `<a href="${escapeHtml(href)}"${external ? ' rel="noopener noreferrer nofollow" target="_blank"' : ''}>${text}</a>`;
		},
		image(token: Tokens.Image) {
			const href = safeHref(token.href);
			const label = escapeHtml(token.text || token.href);
			return href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow" target="_blank">${label}</a>` : label;
		}
	}
});

const PLACEHOLDER = (k: number) => `LEMIESZCITE${k}X`;

export function renderArticle(body: string, locale: string): { html: string; notes: Footnote[] } {
	const notes: Footnote[] = [];
	const noteFor = new Map<number, Footnote>();
	const parts: { html: string; blockHtml?: string }[] = [];

	const footnote = (id: number): Footnote | null => {
		if (noteFor.has(id)) return noteFor.get(id)!;
		const s = db.prepare('SELECT work, section_ref, url FROM sources WHERE id = ?').get(id) as { work: string; section_ref: string; url: string | null } | undefined;
		if (!s) return null;
		const note: Footnote = { n: notes.length + 1, sourceId: id, work: s.work, section_ref: s.section_ref, url: s.url && /^https?:/i.test(s.url) ? s.url : null };
		notes.push(note);
		noteFor.set(id, note);
		return note;
	};
	const marker = (n: Footnote) => `<sup class="fn"><a href="#przypis-${n.n}" aria-label="${n.n}">${n.n}</a></sup>`;

	let source = body;
	for (const c of citationIds(body)) {
		const note = footnote(c.id);
		const k = parts.length;
		if (!note) {
			parts.push({ html: '' }); // unknown source: the token disappears rather than showing raw syntax
		} else if (c.kind === 'quote') {
			const t = db.prepare("SELECT text FROM source_texts WHERE source_id = ? AND locale = ? AND review = 'human_approved'").get(c.id, locale) as { text: string } | undefined;
			if (t) {
				const q = escapeHtml(t.text.trim());
				parts.push({ html: `<q>${q}</q>${marker(note)}`, blockHtml: `<blockquote class="quote"><p>${q}</p><footer>${marker(note)} ${escapeHtml(note.work)}, ${escapeHtml(note.section_ref)}</footer></blockquote>` });
			} else {
				parts.push({ html: marker(note) });
			}
		} else {
			parts.push({ html: marker(note) });
		}
		source = source.replace(c.token, PLACEHOLDER(k));
	}

	let html = markdown.parse(source, { async: false }) as string;
	parts.forEach((p, k) => {
		const ph = PLACEHOLDER(k);
		if (p.blockHtml) html = html.replace(`<p>${ph}</p>`, p.blockHtml);
		html = html.replace(ph, p.html);
	});
	return { html, notes };
}
