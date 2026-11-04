import { Marked, type Tokens } from 'marked';
import { db } from '$lib/server/db';
import { citationIds } from '$lib/server/journal-citations';
import type { Block, ContentBlock } from '$lib/journal-blocks';
import { renderImage, type RenderedImage } from '$lib/server/journal-images';

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

/**
 * Renders the Markdown parts of one article. One instance per article, so footnotes are numbered by first appearance
 * across every block (columns included) and a repeated source keeps its number.
 */
export class ArticleRenderer {
	readonly notes: Footnote[] = [];
	private noteFor = new Map<number, Footnote>();

	constructor(private readonly locale: string) {}

	private footnote(id: number): Footnote | null {
		if (this.noteFor.has(id)) return this.noteFor.get(id)!;
		const s = db.prepare('SELECT work, section_ref, url FROM sources WHERE id = ?').get(id) as { work: string; section_ref: string; url: string | null } | undefined;
		if (!s) return null;
		const note: Footnote = { n: this.notes.length + 1, sourceId: id, work: s.work, section_ref: s.section_ref, url: s.url && /^https?:/i.test(s.url) ? s.url : null };
		this.notes.push(note);
		this.noteFor.set(id, note);
		return note;
	}

	markdown(md: string): string {
		const parts: { html: string; blockHtml?: string }[] = [];
		const marker = (n: Footnote) => `<sup class="fn"><a href="#przypis-${n.n}" aria-label="${n.n}">${n.n}</a></sup>`;
		let source = md;
		for (const c of citationIds(md)) {
			const note = this.footnote(c.id);
			const k = parts.length;
			if (!note) {
				parts.push({ html: '' }); // unknown source: the token disappears rather than showing raw syntax
			} else if (c.kind === 'quote') {
				const t = db.prepare("SELECT text FROM source_texts WHERE source_id = ? AND locale = ? AND review = 'human_approved'").get(c.id, this.locale) as { text: string } | undefined;
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
		return html;
	}
}

/** One Markdown body (used by tests and anything not yet on blocks). */
export function renderArticle(body: string, locale: string): { html: string; notes: Footnote[] } {
	const r = new ArticleRenderer(locale);
	const html = r.markdown(body);
	return { html, notes: r.notes };
}

/** What the public page draws, block by block. HTML parts are already sanitised; headings are plain text. */
export type RenderedContent =
	| { type: 'html'; html: string }
	| { type: 'heading'; level: 2 | 3 | 4; text: string }
	| { type: 'callout'; html: string }
	| { type: 'separator' }
	| RenderedImage;
export type RenderedBlock = RenderedContent | { type: 'columns'; columns: RenderedContent[][] };

export function renderBlocks(blocks: Block[], locale: string): { blocks: RenderedBlock[]; notes: Footnote[] } {
	const r = new ArticleRenderer(locale);
	const content = (b: ContentBlock): RenderedContent => {
		switch (b.type) {
			case 'text':
				return { type: 'html', html: r.markdown(b.md) };
			case 'callout':
				return { type: 'callout', html: r.markdown(b.md) };
			case 'heading':
				return { type: 'heading', level: b.level, text: b.text };
			case 'quote':
				return { type: 'html', html: r.markdown(`[[quote:${b.sourceId}]]`) };
			case 'separator':
				return { type: 'separator' };
			case 'image':
				return renderImage(b, locale) ?? { type: 'html', html: '' };
		}
	};
	const out = blocks.map((b): RenderedBlock => (b.type === 'columns' ? { type: 'columns', columns: b.columns.map((c) => c.map(content)) } : content(b)));
	return { blocks: out, notes: r.notes };
}
