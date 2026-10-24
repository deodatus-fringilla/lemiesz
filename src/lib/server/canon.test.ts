import { describe, expect, it } from 'vitest';
import { getCanon, listCanons } from './canon';

describe('doctrinal canons (corpus/canon)', () => {
	it('lists the canons by number with their titles, and finds a phrase inside them', () => {
		const all = listCanons();
		expect(all.map((c) => c.number)).toEqual(expect.arrayContaining(['01', '04', '09']));
		expect(all.every((c) => c.file.startsWith('corpus/canon/') && c.title.length > 0)).toBe(true);
		expect(listCanons('Wegecjusz').length).toBeGreaterThan(0);
		expect(listCanons('zzz-no-such-phrase-zzz')).toEqual([]);
	});

	it('renders a canon as HTML', () => {
		const first = listCanons()[0];
		const canon = getCanon(first.slug)!;
		expect(canon.html).toMatch(/<h1[^>]*>/);
	});

	it('resolves only names it listed itself: no path from the URL reaches the disk', () => {
		expect(getCanon('../../package')).toBeNull();
		expect(getCanon(String.raw`..\..\docs\00_Canon\03_Rules_of_Engagement`)).toBeNull();
		expect(getCanon('../../docs/00_Canon/03_Rules_of_Engagement')).toBeNull();
		expect(getCanon('')).toBeNull();
	});
});
