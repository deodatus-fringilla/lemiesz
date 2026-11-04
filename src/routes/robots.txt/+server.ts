import type { RequestHandler } from './$types';

/** Crawlers may read the public journal and the landing page; everything else is an internal tool behind login. */
export const GET: RequestHandler = ({ url }) =>
	new Response(
		`User-agent: *
Allow: /$
Allow: /czasopismo
Allow: /biblioteka
Allow: /en/czasopismo
Allow: /en/biblioteka
Disallow: /

Sitemap: ${url.origin}/sitemap.xml
`,
		{ headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } }
	);
