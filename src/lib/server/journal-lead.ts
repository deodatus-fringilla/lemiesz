import { renderLeadHtml } from '$lib/server/journal-render';

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/**
 * The lead is written in the article editor, so it is Markdown. Readers get it as HTML (the abstract, the article's
 * header); cards, the feed and the page description need it as plain text, in one line.
 */
export function leadParts(md: string): { html: string; plain: string } {
	const html = renderLeadHtml(md);
	const plain = html
		.replace(/<\/?(?:p|li|ul|ol|h[1-6]|blockquote|br)\b[^>]*>/g, ' ')
		.replace(/<[^>]+>/g, '')
		.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e])
		.replace(/\s+/g, ' ')
		.trim();
	return { html, plain };
}
