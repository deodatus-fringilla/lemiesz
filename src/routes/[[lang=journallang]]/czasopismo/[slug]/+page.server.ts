import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPublishedArticle } from '$lib/server/journal';
import { renderArticle } from '$lib/server/journal-render';
import { articlePath, langOf, type JournalLang } from '$lib/journal-paths';

/** One published article in one language. Never the working copy: an unpublished or missing text is a 404. */
export const load: PageServerLoad = ({ params, url }) => {
	const lang = langOf(params.lang);
	const article = getPublishedArticle(params.slug, lang);
	if (!article) error(404, 'Not found');
	const other: JournalLang = lang === 'pl' ? 'en' : 'pl';
	const { body, ...meta } = article;
	const { html, notes } = renderArticle(body, lang);
	return {
		lang,
		article: meta,
		html,
		notes,
		other: getPublishedArticle(params.slug, other) ? { lang: other, href: articlePath(other, article.slug) } : null,
		origin: url.origin
	};
};
