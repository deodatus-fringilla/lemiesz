import type { PublishedSummary } from '$lib/server/journal';

/** One rozprawa (treatise): its light and heavy texts. A side is null while that calibre is unwritten or unpublished. */
export interface TreatisePair {
	light: PublishedSummary | null;
	heavy: PublishedSummary | null;
}

/**
 * Groups published articles (newest first) into twin pairs. An article joins its twin's row when that twin is also
 * published; otherwise it gets a row of its own with the other side empty. Rows keep the order of their newest text.
 */
export function groupPairs(articles: PublishedSummary[]): TreatisePair[] {
	const pairs: TreatisePair[] = [];
	const bySlug = new Map<string, TreatisePair>();
	for (const a of articles) {
		const mate = a.twin ? bySlug.get(a.twin.slug) : undefined;
		const pair = mate && !mate[a.caliber] ? mate : { light: null, heavy: null };
		pair[a.caliber] = a;
		if (pair !== mate) pairs.push(pair);
		bySlug.set(a.slug, pair);
	}
	return pairs;
}
