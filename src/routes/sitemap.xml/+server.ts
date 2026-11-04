import type { RequestHandler } from './$types';
import { listPublished } from '$lib/server/journal';
import { articlePath, journalHome, libraryPath, type JournalLang } from '$lib/journal-paths';

/** The public journal for search engines: both section pages and every published article, per language. */
export const GET: RequestHandler = ({ url }) => {
	const urls: { loc: string; lastmod?: string }[] = [];
	for (const lang of ['pl', 'en'] as JournalLang[]) {
		const articles = listPublished({ locale: lang, limit: 5000 });
		if (lang === 'en' && articles.length === 0) continue;
		urls.push({ loc: journalHome(lang) }, { loc: libraryPath(lang) });
		for (const a of articles) urls.push({ loc: articlePath(lang, a.slug), lastmod: a.published_at.slice(0, 10) });
	}
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${url.origin}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
	return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
