import { describe, expect, it } from 'vitest';
import { groupPairs } from './journal-pairs';
import type { PublishedSummary } from '$lib/server/journal';

const art = (slug: string, caliber: 'light' | 'heavy', twin: string | null = null) =>
	({ id: 1, slug, caliber, twin: twin ? { slug: twin, caliber: caliber === 'light' ? 'heavy' : 'light', title: twin } : null }) as unknown as PublishedSummary;

describe('groupPairs', () => {
	it('puts published twins in one row', () => {
		const rows = groupPairs([art('b-heavy', 'heavy', 'b-light'), art('b-light', 'light', 'b-heavy')]);
		expect(rows).toHaveLength(1);
		expect(rows[0].light?.slug).toBe('b-light');
		expect(rows[0].heavy?.slug).toBe('b-heavy');
	});
	it('leaves the other side empty when there is no published twin', () => {
		const rows = groupPairs([art('a', 'heavy'), art('c', 'light')]);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ light: null });
		expect(rows[1]).toMatchObject({ heavy: null });
	});
	it('keeps newest-first order of rows', () => {
		const rows = groupPairs([art('new', 'heavy'), art('old-l', 'light', 'old-h'), art('old-h', 'heavy', 'old-l')]);
		expect(rows.map((r) => (r.heavy ?? r.light)?.slug)).toEqual(['new', 'old-h']);
	});
});
