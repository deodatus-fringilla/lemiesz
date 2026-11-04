import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPublishedArticle } from '$lib/server/journal';
import { renderBlocks } from '$lib/server/journal-render';
import { articlePath, langOf, type JournalLang } from '$lib/journal-paths';

/** One published article in one language. Never the working copy: an unpublished or missing text is a 404. */
export const load: PageServerLoad = ({ params, url }) => {
	const lang = langOf(params.lang);
	const article = getPublishedArticle(params.slug, lang);
	if (!article) error(404, 'Not found');
	const other: JournalLang = lang === 'pl' ? 'en' : 'pl';
	// Readers get the rendered blocks only: neither the raw blocks nor the derived Markdown body is sent.
	const { body: _body, blocks: raw, ...meta } = article;
	const { blocks, notes } = renderBlocks(raw, lang);
	return {
		lang,
		article: meta,
		blocks,
		notes,
		other: getPublishedArticle(params.slug, other) ? { lang: other, href: articlePath(other, article.slug) } : null,
		origin: url.origin
	};
};
