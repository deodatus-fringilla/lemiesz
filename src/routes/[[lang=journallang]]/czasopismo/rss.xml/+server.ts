import type { RequestHandler } from './$types';
import { listPublished } from '$lib/server/journal';
import { articlePath, journalHome, langOf } from '$lib/journal-paths';
import { m } from '$lib/paraglide/messages.js';

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) to RFC 822, as RSS requires. */
const rfc822 = (d: string) => new Date(`${d.replace(' ', 'T')}Z`).toUTCString();

export const GET: RequestHandler = ({ params, url }) => {
	const lang = langOf(params.lang);
	const o = { locale: lang };
	const items = listPublished({ locale: lang, limit: 30 });
	const home = `${url.origin}${journalHome(lang)}`;
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${xml(m.journal_name({}, o))}</title>
<link>${xml(home)}</link>
<description>${xml(m.pub_tagline({}, o))}</description>
<language>${lang}</language>
<atom:link href="${xml(url.href)}" rel="self" type="application/rss+xml" />
${items
	.map((a) => {
		const link = `${url.origin}${articlePath(lang, a.slug)}`;
		const kind = a.caliber === 'light' ? m.journal_caliber_light({}, o) : m.journal_caliber_heavy({}, o);
		return `<item>
<title>${xml(a.title)}</title>
<link>${xml(link)}</link>
<guid isPermaLink="true">${xml(link)}</guid>
<pubDate>${rfc822(a.published_at)}</pubDate>
<category>${xml(kind)}</category>
<description>${xml(a.lead_plain)}</description>
</item>`;
	})
	.join('\n')}
</channel>
</rss>
`;
	return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
