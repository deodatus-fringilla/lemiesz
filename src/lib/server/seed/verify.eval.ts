import { describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { spanInText } from '$lib/server/pipeline/spancheck';

/**
 * Network check (`pnpm eval`, on a database loaded from data/baseline.sql): every source marked
 * `verbatim_url_check = 1` must appear verbatim on the page at its url. Only the text that the page itself carries
 * is checked (origin `original` or `official_translation`); our own translations of it are not on that page.
 * This is the regression test for the v1 seed, whose citations and quotations were invented.
 */
function pageText(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&#8217;|&rsquo;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&')
		.replace(/&#39;/g, "'");
}

const verbatimRows = db
	.prepare(
		`SELECT s.work, s.section_ref, s.url, st.locale, st.text
		 FROM sources s JOIN source_texts st ON st.source_id = s.id
		 WHERE s.verbatim_url_check = 1 AND s.url IS NOT NULL AND st.origin IN ('original', 'official_translation')
		 ORDER BY s.id, st.locale`
	)
	.all() as { work: string; section_ref: string; url: string; locale: string; text: string }[];

describe('sources marked verbatim are verbatim copies of their cited pages', () => {
	const pages = new Map<string, string>();

	it('the database holds data/baseline.sql and marks some sources for the check', () => {
		expect(verbatimRows.length).toBeGreaterThan(0);
	});

	for (const row of verbatimRows) {
		it(`${row.work} ${row.section_ref} (${row.locale})`, async () => {
			if (!pages.has(row.url)) {
				const res = await fetch(row.url, { signal: AbortSignal.timeout(60_000) });
				expect(res.ok, `${row.url} returned ${res.status}`).toBe(true);
				pages.set(row.url, pageText(await res.text()));
			}
			expect(spanInText(row.text, pages.get(row.url)!)).toBe(true);
		});
	}
});
