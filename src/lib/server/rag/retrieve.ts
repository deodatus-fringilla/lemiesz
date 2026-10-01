import { db } from '$lib/server/db';
import { DEFAULT_LOCALE, LOCALE_CODES, isLocale, type Locale } from '$lib/i18n/locales';
import type { Embedder } from '$lib/server/llm/embedder';
import { contentTokens, lexicalCoverage, searchFts, type OwnerKind } from './fts';
import { reciprocalRankFusion } from './fuse';
import { needsWatermark, isAllowed, type TrustOptions, type UseContext } from './trust';
import { indexMissing, searchVectors } from './vectors';
import type { Origin, Review } from '$lib/server/review';

// ---- language detection ------------------------------------------------------
const PL_WORDS = new Set('i w z na do nie się że jest to jak dla przez ale czy co oraz który są być' .split(' '));
const EN_WORDS = new Set('the and of to in is are that for with you your not but this be as by on or it' .split(' '));

/** Cheap pl/en detector for attack lines. `confident` is false when the signal is weak (both languages get searched). */
export function detectLocale(text: string): { locale: Locale; confident: boolean } {
	if (/[ąćęłńóśźż]/i.test(text)) return { locale: 'pl', confident: true };
	const words = text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
	const pl = words.filter((w) => PL_WORDS.has(w)).length;
	const en = words.filter((w) => EN_WORDS.has(w)).length;
	if (pl !== en) return { locale: pl > en ? 'pl' : 'en', confident: Math.abs(pl - en) >= 2 };
	return { locale: DEFAULT_LOCALE, confident: false };
}

// ---- types -------------------------------------------------------------------
export interface Thresholds {
	/** Cosine similarity at or above which a vector hit counts as on-topic. 0.79 was calibrated with `pnpm eval` on multilingual-e5-small and the 16-line starter golden set (margin is thin: re-run after growing the set or changing model). */
	vectorMin: number;
	/** A lexical hit counts only if this share of the query's content words appears in the text… */
	lexicalMinRatio: number;
	/** …and at least this many of them do. */
	lexicalMinMatched: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
	vectorMin: Number(process.env.RAG_VECTOR_MIN ?? 0.79),
	lexicalMinRatio: Number(process.env.RAG_LEXICAL_MIN_RATIO ?? 0.5),
	lexicalMinMatched: Number(process.env.RAG_LEXICAL_MIN_MATCHED ?? 2)
};

export interface RetrieveOptions {
	query: string;
	context: UseContext;
	trust?: TrustOptions;
	outputLocale?: Locale;
	queryLocale?: Locale;
	embedder?: Embedder | null;
	limit?: number;
	thresholds?: Partial<Thresholds>;
}

interface TextInfo {
	locale: string;
	review: Review;
	origin: Origin;
}

export interface EvidenceSource {
	id: number;
	work: string;
	section_ref: string;
	url: string | null;
	license: string;
	cleared_to_store: boolean;
	original_locale: string;
	locale: string;
	text: string;
	/** Not in the requested output language: the UI must label it (plan §8.2 j). */
	isFallback: boolean;
	origin: Origin;
	review: Review;
	machineTranslated: boolean;
}

export interface EvidenceArgument {
	id: number;
	fallacy_type: string | null;
	core_principle: string;
	locale: string;
	opponent_claim: string;
	counter_punch: string;
	isFallback: boolean;
	origin: Origin;
	review: Review;
	machineTranslated: boolean;
	sources: EvidenceSource[];
}

export interface Match {
	score: number;
	lexical?: { matched: number; total: number };
	cosine?: number;
}

export type Tier = 'arguments' | 'sources' | 'none';

export interface RetrieveResult {
	tier: Tier;
	queryLocale: Locale;
	outputLocale: Locale;
	arguments: (EvidenceArgument & { match: Match })[];
	/** Sources to show / cite: the linked sources of the matched arguments, or direct matches at tier "sources". */
	sources: (EvidenceSource & { match?: Match })[];
	reason?: 'no_strong_source';
	/** True when any card behind the result is not human-approved (Content Engine outputs must then be watermarked). */
	watermark: boolean;
}

// ---- candidate gathering -----------------------------------------------------
interface Candidate {
	key: string; // "<kind>:<id>"
	id: number;
	match: Match;
	fusedScore: number;
}

const reviewStmt = {
	source: db.prepare('SELECT locale, review, origin FROM source_texts WHERE source_id = ?'),
	argument: db.prepare('SELECT locale, review, origin FROM argument_texts WHERE argument_id = ?')
};

function textInfos(kind: OwnerKind, id: number): TextInfo[] {
	return reviewStmt[kind].all(id) as TextInfo[];
}

async function gather(
	kind: OwnerKind,
	o: Required<Pick<RetrieveOptions, 'query' | 'context'>> & {
		trust: TrustOptions;
		queryLocale: Locale;
		confident: boolean;
		embedder: Embedder | null;
		th: Thresholds;
	}
): Promise<Candidate[]> {
	const allowed = (id: number, locale: string) =>
		textInfos(kind, id).some((t) => t.locale === locale && isAllowed(t.review, o.context, o.trust));

	// Lexical: OR-query in the query language (and in every language when detection is unsure).
	const lexLocales: Locale[] = o.confident ? [o.queryLocale] : [...LOCALE_CODES];
	const lexical = new Map<string, { rank: number; matched: number; total: number; substantive: boolean }>();
	let position = 0;
	for (const locale of lexLocales) {
		for (const h of searchFts(locale, o.query, { ownerType: kind, limit: 30, mode: 'or' })) {
			if (!allowed(h.owner_id, locale)) continue;
			const cov = lexicalCoverage(o.query, locale, `${h.title} ${h.content}`);
			const key = `${kind}:${h.owner_id}`;
			const prev = lexical.get(key);
			if (!prev || cov.matched > prev.matched) lexical.set(key, { rank: prev?.rank ?? position, ...cov });
			position++;
		}
	}
	const lexicalOrder = [...lexical.entries()].sort((a, b) => a[1].rank - b[1].rank).map(([k]) => k);

	// Vector: every language (the cross-lingual path).
	const cosines = new Map<string, number>();
	if (o.embedder) {
		await indexMissing(o.embedder);
		const q = await o.embedder.embedQuery(o.query);
		for (const h of searchVectors(q, o.embedder.model, { ownerType: kind, limit: 40 })) {
			if (!allowed(h.ownerId, h.locale)) continue;
			const key = `${kind}:${h.ownerId}`;
			if (!cosines.has(key)) cosines.set(key, h.score); // hits arrive best-first
		}
	}
	const vectorOrder = [...cosines.keys()];

	const fused = reciprocalRankFusion([{ keys: lexicalOrder }, { keys: vectorOrder }]);
	const out: Candidate[] = [];
	for (const { key, score } of fused) {
		const lex = lexical.get(key);
		const cos = cosines.get(key);
		const strongLex =
			!!lex &&
			lex.substantive &&
			lex.matched >= Math.min(o.th.lexicalMinMatched, lex.total) &&
			lex.matched / Math.max(lex.total, 1) >= o.th.lexicalMinRatio;
		const strongVec = cos !== undefined && cos >= o.th.vectorMin;
		if (!strongLex && !strongVec) continue;
		out.push({
			key,
			id: Number(key.split(':')[1]),
			fusedScore: score,
			match: {
				score,
				lexical: lex ? { matched: lex.matched, total: lex.total } : undefined,
				cosine: cos
			}
		});
	}
	return out;
}

// ---- output resolution -------------------------------------------------------
function pickAllowed<T extends TextInfo>(rows: T[], outputLocale: string, originalLocale: string | null, ctx: UseContext, trust: TrustOptions): { row: T; isFallback: boolean } | null {
	const ok = rows.filter((r) => isAllowed(r.review, ctx, trust));
	if (ok.length === 0) return null;
	const exact = ok.find((r) => r.locale === outputLocale);
	if (exact) return { row: exact, isFallback: false };
	const orig = originalLocale ? ok.find((r) => r.locale === originalLocale) : undefined;
	return { row: orig ?? ok[0], isFallback: true };
}

function loadSource(id: number, outputLocale: string, ctx: UseContext, trust: TrustOptions): EvidenceSource | null {
	const s = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as
		| { id: number; work: string; section_ref: string; url: string | null; license: string; cleared_to_store: number; original_locale: string }
		| undefined;
	if (!s) return null;
	const rows = db.prepare('SELECT locale, text, review, origin FROM source_texts WHERE source_id = ?').all(id) as (TextInfo & { text: string })[];
	const pick = pickAllowed(rows, outputLocale, s.original_locale, ctx, trust);
	if (!pick) return null;
	return {
		id: s.id,
		work: s.work,
		section_ref: s.section_ref,
		url: s.url,
		license: s.license,
		cleared_to_store: !!s.cleared_to_store,
		original_locale: s.original_locale,
		locale: pick.row.locale,
		text: pick.row.text,
		isFallback: pick.isFallback,
		origin: pick.row.origin,
		review: pick.row.review,
		machineTranslated: pick.row.origin === 'machine_translation'
	};
}

function loadArgument(id: number, outputLocale: string, ctx: UseContext, trust: TrustOptions): EvidenceArgument | null {
	const a = db.prepare('SELECT id, fallacy_type, core_principle FROM arguments WHERE id = ?').get(id) as
		| { id: number; fallacy_type: string | null; core_principle: string }
		| undefined;
	if (!a) return null;
	const rows = db
		.prepare('SELECT locale, opponent_claim, counter_punch, review, origin FROM argument_texts WHERE argument_id = ?')
		.all(id) as (TextInfo & { opponent_claim: string; counter_punch: string })[];
	const pick = pickAllowed(rows, outputLocale, null, ctx, trust);
	if (!pick) return null;
	const linked = (db.prepare('SELECT source_id FROM argument_sources WHERE argument_id = ? ORDER BY source_id').all(id) as { source_id: number }[])
		.map((l) => loadSource(l.source_id, outputLocale, ctx, trust))
		.filter((s): s is EvidenceSource => s !== null);
	return {
		id: a.id,
		fallacy_type: a.fallacy_type,
		core_principle: a.core_principle,
		locale: pick.row.locale,
		opponent_claim: pick.row.opponent_claim,
		counter_punch: pick.row.counter_punch,
		isFallback: pick.isFallback,
		origin: pick.row.origin,
		review: pick.row.review,
		machineTranslated: pick.row.origin === 'machine_translation',
		sources: linked
	};
}

/**
 * Two-tier retrieval (plan §4): match the attack against `arguments` first (FTS + vectors, fused with
 * RRF, trust-filtered) and pull their linked sources; if nothing is strong, fall back to a general
 * `sources` search; if that also fails, return the deterministic "no strong source" state so the model
 * is never asked to improvise.
 */
export async function retrieve(options: RetrieveOptions): Promise<RetrieveResult> {
	const detected = options.queryLocale ? { locale: options.queryLocale, confident: true } : detectLocale(options.query);
	const outputLocale: Locale = options.outputLocale && isLocale(options.outputLocale) ? options.outputLocale : detected.locale;
	const trust = options.trust ?? {};
	const limit = options.limit ?? 3;
	const th: Thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
	const base = {
		query: options.query,
		context: options.context,
		trust,
		queryLocale: detected.locale,
		confident: detected.confident,
		embedder: options.embedder ?? null,
		th
	};

	const empty = (reason?: 'no_strong_source'): RetrieveResult => ({
		tier: 'none',
		queryLocale: detected.locale,
		outputLocale,
		arguments: [],
		sources: [],
		reason,
		watermark: false
	});
	if (contentTokens(options.query, detected.locale).length === 0 && !options.embedder) return empty('no_strong_source');

	// Tier 1: arguments
	const argCandidates = await gather('argument', base);
	const args: (EvidenceArgument & { match: Match })[] = [];
	for (const c of argCandidates) {
		const a = loadArgument(c.id, outputLocale, options.context, trust);
		if (a) args.push({ ...a, match: c.match });
		if (args.length >= limit) break;
	}
	if (args.length > 0) {
		const seen = new Set<number>();
		const sources: EvidenceSource[] = [];
		for (const a of args) for (const s of a.sources) if (!seen.has(s.id)) (seen.add(s.id), sources.push(s));
		const reviews = [...args.map((a) => a.review), ...sources.map((s) => s.review)];
		return { tier: 'arguments', queryLocale: detected.locale, outputLocale, arguments: args, sources, watermark: needsWatermark(reviews) };
	}

	// Tier 2: sources
	const srcCandidates = await gather('source', base);
	const sources: (EvidenceSource & { match: Match })[] = [];
	for (const c of srcCandidates) {
		const s = loadSource(c.id, outputLocale, options.context, trust);
		if (s) sources.push({ ...s, match: c.match });
		if (sources.length >= limit) break;
	}
	if (sources.length > 0) {
		return { tier: 'sources', queryLocale: detected.locale, outputLocale, arguments: [], sources, watermark: needsWatermark(sources.map((s) => s.review)) };
	}

	// Tier 3: nothing strong enough
	return empty('no_strong_source');
}

/** Counts a use of each returned card (drives the review queue's "highest impact first" ordering). */
export function recordUsage(result: RetrieveResult): void {
	const stmt = db.prepare(
		`INSERT INTO card_usage (owner_type, owner_id, uses, last_used_at) VALUES (?, ?, 1, datetime('now'))
		 ON CONFLICT(owner_type, owner_id) DO UPDATE SET uses = uses + 1, last_used_at = datetime('now')`
	);
	db.transaction(() => {
		for (const a of result.arguments) stmt.run('argument', a.id);
		for (const s of result.sources) stmt.run('source', s.id);
	})();
}
