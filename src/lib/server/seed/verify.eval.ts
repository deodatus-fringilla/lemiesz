import { describe, expect, it } from 'vitest';
import { spanInText } from '$lib/server/pipeline/spancheck';
import { SEED_SOURCES } from './seedData';

/**
 * Network check (`pnpm eval`): every seed row that claims to be copied from a URL must actually appear
 * verbatim on that page. This is the regression test for the v1 seed, whose citations and quotations
 * were invented.
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

const verbatimRows = SEED_SOURCES.filter((s) => s.reviewer === 'seed:verbatim-from-url' && s.url);

describe('seed sources are verbatim copies of their cited pages', () => {
	const pages = new Map<string, string>();

	for (const row of verbatimRows) {
		it(`${row.work} ${row.section_ref}`, async () => {
			if (!pages.has(row.url!)) {
				const res = await fetch(row.url!, { signal: AbortSignal.timeout(60_000) });
				expect(res.ok, `${row.url} returned ${res.status}`).toBe(true);
				pages.set(row.url!, pageText(await res.text()));
			}
			expect(spanInText(row.text, pages.get(row.url!)!)).toBe(true);
		});
	}
});
