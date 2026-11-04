import { describe, expect, it } from 'vitest';
import { PUBLIC_JOURNAL_PATH, articlePath, feedPath, journalHome, langOf, libraryPath } from './journal-paths';

describe('public journal paths', () => {
	it('builds Polish paths without a prefix and English ones under /en', () => {
		expect(journalHome('pl')).toBe('/czasopismo');
		expect(articlePath('en', 'neutralnosc')).toBe('/en/czasopismo/neutralnosc');
		expect(libraryPath('en')).toBe('/en/biblioteka');
		expect(feedPath('pl')).toBe('/czasopismo/rss.xml');
		expect(langOf(undefined)).toBe('pl');
		expect(langOf('en')).toBe('en');
	});

	it('opens exactly the journal to readers, nothing internal', () => {
		for (const p of ['/czasopismo', '/czasopismo/', '/czasopismo/a-b', '/czasopismo/rss.xml', '/en/czasopismo/x', '/biblioteka', '/en/biblioteka', '/sitemap.xml'])
			expect(PUBLIC_JOURNAL_PATH.test(p), p).toBe(true);
		for (const p of ['/redakcja', '/redakcja/1', '/en/redakcja', '/czasopismox', '/fr/czasopismo', '/spichlerz', '/api/letters', '/x/czasopismo', '/sitemap.xml.bak'])
			expect(PUBLIC_JOURNAL_PATH.test(p), p).toBe(false);
	});
});
