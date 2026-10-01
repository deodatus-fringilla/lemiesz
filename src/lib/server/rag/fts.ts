import { db } from '$lib/server/db';
import { LOCALES, ftsTable, isLocale, type Locale } from '$lib/i18n/locales';

export type OwnerKind = 'source' | 'argument';

export interface FtsSearchResult {
	owner_type: OwnerKind;
	owner_id: number;
	title: string;
	content: string;
	rank: number;
	snippet: string;
}

// Common Polish case endings, longest first. Used only to widen the *query* (plan §7.2 1);
// the per-locale `keywords` column carries hand-curated forms.
const POLISH_COMMON_SUFFIXES = [
	'owego', 'owych', 'owski', 'owska', 'owskie',
	'iemu', 'iego', 'nych', 'nymi', 'cach', 'kach',
	'ach', 'ami', 'ego', 'emu', 'ych', 'ich', 'owi',
	'om', 'am', 'em', 'ów', 'ow', 'ej', 'ie', 'ce',
	'a', 'e', 'u', 'y', 'i', 'o'
].sort((a, b) => b.length - a.length);

function getPolishStems(token: string, minPrefix: number): string[] {
	const lower = token.toLowerCase();
	const stems = new Set<string>([lower]);
	for (const suffix of POLISH_COMMON_SUFFIXES) {
		if (lower.endsWith(suffix) && lower.length - suffix.length >= minPrefix) {
			stems.add(lower.slice(0, -suffix.length));
			break;
		}
	}
	return Array.from(stems);
}

const STOPWORDS: Record<string, Set<string>> = {
	pl: new Set(
		('i w we z ze na do od po za o u a oraz albo lub ale że ze się nie jest są być był była było byli jak jako dla ' +
			'przez przy nad pod przed to ten ta te tego tej tym ci ich jego jej nas was wy my ja ty on ona ono oni one ' +
			'czy co który która które którzy tak więc już tylko też może można będzie mają ma mamy macie ktoś coś kiedy gdy ' +
			'bo aby żeby jeśli jeżeli więcej bardzo lecz ani').split(' ')
	),
	en: new Set(
		('a an and are as at be been but by can do does for from has have he her his i if in is it its me my no not of on ' +
			'or our she so that the their them then there they this to too us was we were what when which who will with you ' +
			'your than into about over under all any more most other some such only own same very just also').split(' ')
	)
};

const normalizeWord = (w: string) => w.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');

/** Content words of a query: punctuation and stopwords removed. Falls back to all words if that leaves nothing. */
export function contentTokens(query: string, locale: Locale): string[] {
	const words = query
		.replace(/[^\p{L}\p{N}\s-]/gu, ' ')
		.split(/\s+/)
		.map((t) => t.replace(/^-+|-+$/g, ''))
		.filter(Boolean);
	const stop = STOPWORDS[locale];
	const unique = (list: string[]) => [...new Map(list.map((w) => [w.toLowerCase(), w])).values()];
	const content = words.filter((w) => !stop?.has(w.toLowerCase()));
	return unique(content.length > 0 ? content : words);
}

/** Variants of a query token to match against document words (the token itself + a de-inflected Polish stem). */
function tokenVariants(token: string, locale: Locale): string[] {
	const minPrefix = LOCALES[locale]?.minPrefix ?? 3;
	const base = locale === 'pl' ? getPolishStems(token, minPrefix) : [token.toLowerCase()];
	return [...new Set(base.map(normalizeWord))].filter(Boolean);
}

/**
 * How many of the query's content words appear (as word prefixes, diacritics ignored) in a document.
 * Used to decide whether a lexical hit is genuinely on-topic rather than one incidental word.
 */
export function lexicalCoverage(
	query: string,
	locale: Locale,
	docText: string
): { matched: number; total: number; ratio: number; substantive: boolean } {
	const tokens = contentTokens(query, locale);
	if (tokens.length === 0) return { matched: 0, total: 0, ratio: 0, substantive: false };
	const docWords = docText.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(normalizeWord);
	let matched = 0;
	// A hit built only from numbers or tiny words ("1", "or") is not evidence of anything.
	let substantive = false;
	for (const token of tokens) {
		const variants = tokenVariants(token, locale);
		if (docWords.some((w) => variants.some((v) => (v.length >= 3 ? w.startsWith(v) : w === v)))) {
			matched++;
			if (token.length >= 4 && !/^\d+$/.test(token)) substantive = true;
		}
	}
	return { matched, total: tokens.length, ratio: matched / tokens.length, substantive };
}

export type QueryMode = 'and' | 'or';

/**
 * Sanitizes a user query for FTS5: every token is quoted (so FTS operators like AND/OR/NEAR and
 * punctuation cannot break the query), long tokens become prefix matches, and Polish tokens are
 * expanded with a de-inflected stem. `and` (default) is for interactive search: every word must match.
 * `or` is for retrieval from a natural-language attack line: stopwords are dropped and BM25 ranks
 * documents by how many content words they contain.
 */
export function prepareFtsQuery(query: string, locale: Locale, mode: QueryMode = 'and'): string {
	const minPrefix = LOCALES[locale]?.minPrefix ?? 3;
	const cleaned = query.replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();
	if (!cleaned) return '';

	const tokens =
		mode === 'or'
			? contentTokens(cleaned, locale)
			: cleaned
					.split(/\s+/)
					.map((t) => t.replace(/^-+|-+$/g, ''))
					.filter((t) => t.length > 0);
	if (tokens.length === 0) return '';

	const parts = tokens.map((token) => {
		if (locale === 'pl') {
			const stems = getPolishStems(token, minPrefix);
			if (stems.length > 1) return `(${stems.map((s) => `"${s}"*`).join(' OR ')})`;
		}
		return token.length >= minPrefix ? `"${token}"*` : `"${token}"`;
	});
	return parts.join(mode === 'or' ? ' OR ' : ' ');
}

/** Replaces the FTS row for one owner in one locale. Silently ignores unregistered locales (e.g. original-only). */
export function syncFts(
	ownerType: OwnerKind,
	ownerId: number,
	locale: string,
	title: string,
	content: string,
	keywords?: string | null
): void {
	if (!isLocale(locale)) return;
	const table = ftsTable(locale);
	db.prepare(`DELETE FROM ${table} WHERE owner_type = ? AND owner_id = ?`).run(ownerType, ownerId);
	db.prepare(
		`INSERT INTO ${table} (owner_type, owner_id, title, content, keywords) VALUES (?, ?, ?, ?, ?)`
	).run(ownerType, ownerId, title, content, keywords ?? '');
}

/** Removes an owner from every registered locale's FTS table. */
export function removeFromAllFts(ownerType: OwnerKind, ownerId: number): void {
	for (const locale of Object.keys(LOCALES) as Locale[]) {
		db.prepare(`DELETE FROM ${ftsTable(locale)} WHERE owner_type = ? AND owner_id = ?`).run(
			ownerType,
			ownerId
		);
	}
}

/** BM25 search in one locale's table. Lower rank = better match (FTS5 bm25 is negative). */
export function searchFts(
	locale: Locale,
	query: string,
	options: { ownerType?: OwnerKind; limit?: number; mode?: QueryMode } = {}
): FtsSearchResult[] {
	const ftsQuery = prepareFtsQuery(query, locale, options.mode ?? 'and');
	if (!ftsQuery) return [];

	const table = ftsTable(locale);
	const params: (string | number)[] = [ftsQuery];
	let sql = `
		SELECT owner_type, owner_id, title, content,
			bm25(${table}, 1.0, 1.0, 3.0, 1.0, 2.0) AS rank,
			snippet(${table}, 3, '[[', ']]', '…', 25) AS snippet
		FROM ${table}
		WHERE ${table} MATCH ?`;
	if (options.ownerType) {
		sql += ' AND owner_type = ?';
		params.push(options.ownerType);
	}
	sql += ' ORDER BY rank ASC LIMIT ?';
	params.push(options.limit ?? 20);

	try {
		return db.prepare(sql).all(...params) as FtsSearchResult[];
	} catch (err) {
		console.error(`[FTS] Search error on ${table} with query "${ftsQuery}":`, err);
		return [];
	}
}
