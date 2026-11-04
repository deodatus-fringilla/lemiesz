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

/** What groupEditorRows needs of a back-office row: which article and language it is, its calibre and its twin. */
interface EditorRowLike {
	id: number;
	twin_id: number | null;
	locale: string;
	caliber: 'light' | 'heavy';
}
export interface EditorPair<T> {
	key: string;
	locale: string;
	light: T | null;
	heavy: T | null;
}

/** The id shared by the two twins of a rozprawe (the lower of the two article ids). */
export const rozprawaId = (r: { id: number; twin_id: number | null }): number => Math.min(r.id, r.twin_id ?? r.id);

/** Groups back-office rows (one per article and language) into one row per rozprawe and language, keeping the order of first appearance. */
export function groupEditorRows<T extends EditorRowLike>(rows: T[]): EditorPair<T>[] {
	const pairs = new Map<string, EditorPair<T>>();
	for (const r of rows) {
		const key = `${rozprawaId(r)}-${r.locale}`;
		const pair = pairs.get(key) ?? { key, locale: r.locale, light: null, heavy: null };
		pair[r.caliber] = r;
		pairs.set(key, pair);
	}
	return [...pairs.values()];
}
