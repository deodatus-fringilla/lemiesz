import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPublishedArticle } from '$lib/server/journal';
import { escapeHtml, renderBlocks } from '$lib/server/journal-render';
import { langOf } from '$lib/journal-paths';
import { m } from '$lib/paraglide/messages.js';

/**
 * Returns a published journal article rendered as safe HTML (blocks + footnotes) so `<DocumentReader />` can display
 * it directly from `/czasopismo` without navigating away.
 */
export const GET: RequestHandler = ({ params }) => {
	const lang = langOf(params.lang);
	const article = getPublishedArticle(params.slug, lang);
	if (!article) error(404, 'Not found');

	const { blocks, notes } = renderBlocks(article.blocks, lang);
	const parts: string[] = [];

	if (article.lead_html) {
		parts.push(`<div class="lead">${article.lead_html}</div><hr />`);
	}

	for (const b of blocks) {
		if (b.type === 'html') parts.push(b.html);
		else if (b.type === 'heading') parts.push(`<h${b.level}>${escapeHtml(b.text)}</h${b.level}>`);
		else if (b.type === 'callout') parts.push(`<aside class="callout">${b.html}</aside>`);
		else if (b.type === 'separator') parts.push('<hr />');
		else if (b.type === 'image') {
			const size = b.width && b.height ? ` width="${b.width}" height="${b.height}"` : '';
			const caption = b.caption ? `<span>${escapeHtml(b.caption)}</span> ` : '';
			const credit = `${escapeHtml(b.credit)}${b.license ? ` · ${escapeHtml(b.license)}` : ''}`;
			parts.push(`<figure><img src="${escapeHtml(b.src)}" alt="${escapeHtml(b.alt)}"${size} loading="lazy" /><figcaption>${caption}<small>${credit}</small></figcaption></figure>`);
		}
	}

	if (notes.length) {
		const fnTitle = escapeHtml(m.pub_footnotes({}, { locale: lang }));
		const linkLabel = escapeHtml(m.pub_source_link({}, { locale: lang }));
		const items = notes
			.map(
				(n) =>
					`<li id="przypis-${n.n}">${escapeHtml(n.work)}, ${escapeHtml(n.section_ref)}${
						n.url ? ` · <a href="${escapeHtml(n.url)}" rel="noopener noreferrer nofollow" target="_blank">${linkLabel}</a>` : ''
					}</li>`
			)
			.join('');
		parts.push(`<hr /><h3>${fnTitle}</h3><ol>${items}</ol>`);
	}

	return json({
		title: article.title,
		author: article.author,
		published_at: article.published_at,
		caliber: article.caliber,
		columns: article.columns,
		html: parts.join('\n')
	});
};
