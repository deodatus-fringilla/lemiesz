import { db } from '$lib/server/db';
import type { Embedder } from '$lib/server/llm/embedder';
import type { LlmProvider } from '$lib/server/llm/provider';
import { createArgument } from '$lib/server/arguments';
import { human } from '$lib/server/review';
import { runSeed } from '$lib/server/seed/seed';
import { retrieve, type Thresholds } from '$lib/server/rag/retrieve';
import { auditCard } from '$lib/server/pipeline/auditor';
import { forceReview } from '$lib/server/testing';
import golden from '../../../../eval/golden.json';
import badCards from '../../../../eval/bad-cards.json';

export interface GoldenEntry {
	id: string;
	locale: string;
	query: string;
	expect: string[];
}

export const GOLDEN: GoldenEntry[] = golden.entries;

/** The eval writes review states directly, so it must never run against a real database. */
function assertThrowawayDb(): void {
	const file = (db.pragma('database_list') as { file: string }[])[0]?.file ?? '';
	if (!/lemiesz-(test|eval)-/.test(file)) {
		throw new Error(`Refusing to run the evaluation harness on "${file}": it is not a throw-away database.`);
	}
}

/** Seeds the starter corpus and marks every text human_approved so retrieval can see it. Throw-away DBs only. */
export function prepareEvalCorpus(): Map<string, number> {
	assertThrowawayDb();
	runSeed();
	const rows = db.prepare('SELECT id, work, section_ref FROM sources').all() as { id: number; work: string; section_ref: string }[];
	for (const r of db.prepare('SELECT source_id AS id, locale FROM source_texts').all() as { id: number; locale: string }[]) {
		forceReview('source', r.id, r.locale, 'human_approved');
	}
	return new Map(rows.map((r) => [`${r.work} ${r.section_ref}`, r.id]));
}

export type Method = 'lexical' | 'vector' | 'hybrid';

const PERMISSIVE: Thresholds = { vectorMin: -1, lexicalMinRatio: 0, lexicalMinMatched: 1 };
const METHOD_THRESHOLDS: Record<Method, Partial<Thresholds>> = {
	lexical: PERMISSIVE,
	vector: { vectorMin: -1, lexicalMinRatio: 99, lexicalMinMatched: 99 },
	hybrid: PERMISSIVE
};

export interface PairRecall {
	pair: string;
	positives: number;
	hits: number;
	recall: number;
}

export interface RetrievalReport {
	/** What users actually get: hybrid retrieval with the REAL default thresholds. */
	endToEnd: { recall: number; missed: string[] } | null;
	methods: Partial<Record<Method, { recallAt5: number; byPair: PairRecall[]; missed: string[] }>>;
	negatives: { total: number; correctlyEmpty: number; falsePositives: string[] };
	/** Cosine range to help choose RAG_VECTOR_MIN; null when vectors are off or the ranges overlap. */
	vectorThreshold: { positiveMin: number; negativeMax: number; suggested: number | null } | null;
}

export async function evaluateRetrieval(
	embedder: Embedder | null,
	entries: GoldenEntry[] = GOLDEN
): Promise<RetrievalReport> {
	const ids = prepareEvalCorpus();
	const positives = entries.filter((e) => e.expect.length > 0);
	const negatives = entries.filter((e) => e.expect.length === 0);
	const methods: RetrievalReport['methods'] = {};

	const run: Method[] = embedder ? ['lexical', 'vector', 'hybrid'] : ['lexical'];
	const bestCosines: number[] = [];
	for (const method of run) {
		const byPair = new Map<string, PairRecall>();
		const missed: string[] = [];
		let hits = 0;
		for (const e of positives) {
			const r = await retrieve({
				query: e.query,
				context: 'shield',
				limit: 5,
				embedder: method === 'lexical' ? null : embedder,
				thresholds: METHOD_THRESHOLDS[method]
			});
			const got = new Set(r.sources.map((s) => s.id));
			const wanted = e.expect.map((label) => ids.get(label)).filter((x): x is number => x !== undefined);
			if (wanted.length !== e.expect.length) throw new Error(`Golden entry ${e.id} names an unknown source`);
			const hit = wanted.some((id) => got.has(id));
			if (hit) hits++;
			else missed.push(e.id);

			const expectedLocale = (db.prepare('SELECT locale FROM source_texts WHERE source_id = ? LIMIT 1').get(wanted[0]) as { locale: string }).locale;
			const pair = `${e.locale}->${expectedLocale}`;
			const p = byPair.get(pair) ?? { pair, positives: 0, hits: 0, recall: 0 };
			p.positives++;
			if (hit) p.hits++;
			byPair.set(pair, p);

			if (method === 'hybrid') {
				const cos = r.sources.filter((s) => wanted.includes(s.id)).map((s) => s.match?.cosine).filter((c): c is number => c !== undefined);
				if (cos.length) bestCosines.push(Math.max(...cos));
			}
		}
		for (const p of byPair.values()) p.recall = p.hits / p.positives;
		methods[method] = { recallAt5: positives.length ? hits / positives.length : 0, byPair: [...byPair.values()], missed };
	}

	// End to end: hybrid with the real thresholds (positives that come back as 'no strong source' count as misses).
	let endToEnd: RetrievalReport['endToEnd'] = null;
	if (embedder) {
		const missedE2E: string[] = [];
		for (const e of positives) {
			const r = await retrieve({ query: e.query, context: 'shield', limit: 5, embedder });
			const got = new Set(r.sources.map((s) => s.id));
			if (!e.expect.some((label) => got.has(ids.get(label)!))) missedE2E.push(e.id);
		}
		endToEnd = { recall: positives.length ? 1 - missedE2E.length / positives.length : 0, missed: missedE2E };
	}

	// Negatives use the REAL thresholds: this measures the "no strong source" behaviour users will see.
	const falsePositives: string[] = [];
	for (const e of negatives) {
		const r = await retrieve({ query: e.query, context: 'shield', limit: 5, embedder });
		if (r.tier !== 'none') falsePositives.push(e.id);
	}

	let vectorThreshold: RetrievalReport['vectorThreshold'] = null;
	if (embedder && bestCosines.length) {
		let negativeMax = -1;
		for (const e of negatives) {
			const r = await retrieve({ query: e.query, context: 'shield', limit: 5, embedder, thresholds: METHOD_THRESHOLDS.vector });
			for (const s of r.sources) if (s.match?.cosine !== undefined) negativeMax = Math.max(negativeMax, s.match.cosine);
		}
		const positiveMin = Math.min(...bestCosines);
		vectorThreshold = {
			positiveMin,
			negativeMax,
			suggested: positiveMin > negativeMax ? Number(((positiveMin + negativeMax) / 2).toFixed(3)) : null
		};
	}

	return {
		endToEnd,
		methods,
		negatives: { total: negatives.length, correctlyEmpty: negatives.length - falsePositives.length, falsePositives },
		vectorThreshold
	};
}

// ---- auditor -----------------------------------------------------------------

export interface AuditorReport {
	deterministicCatchRate: number;
	llmCatchRate: number;
	controlPassRate: number;
	details: { id: string; kind: string; deterministic: boolean; outcome: string; reason: string }[];
}

/**
 * Plants known-bad cards (fabricated quotes, misattributions, off-doctrine punches, over-reach) plus sound
 * controls and measures how the auditor treats them (plan §7.5). Run it whenever the auditor model or prompt changes.
 */
export async function evaluateAuditor(auditor: LlmProvider): Promise<AuditorReport> {
	const ids = prepareEvalCorpus();
	const details: AuditorReport['details'] = [];

	for (const c of badCards.cards) {
		const sourceId = ids.get(c.source);
		if (!sourceId) throw new Error(`Bad-card ${c.id} names an unknown source "${c.source}"`);
		const argId = createArgument(
			{
				locale: c.locale,
				opponent_claim: c.opponent_claim,
				counter_punch: c.counter_punch,
				core_principle: c.core_principle,
				source_ids: [sourceId],
				origin: 'ai_drafted',
				spans: c.spans.map((span) => ({ source_id: sourceId, span }))
			},
			human('eval')
		);
		const r = await auditCard({ provider: auditor, argumentId: argId, locale: c.locale });
		details.push({ id: c.id, kind: c.kind, deterministic: c.deterministic, outcome: r.result, reason: r.reason });
	}

	const bad = details.filter((d) => d.kind !== 'control');
	const det = bad.filter((d) => d.deterministic);
	const llm = bad.filter((d) => !d.deterministic);
	const controls = details.filter((d) => d.kind === 'control');
	const rate = (list: typeof details, pred: (d: (typeof details)[number]) => boolean) =>
		list.length ? list.filter(pred).length / list.length : 1;
	return {
		deterministicCatchRate: rate(det, (d) => d.outcome !== 'ai_verified'),
		llmCatchRate: rate(llm, (d) => d.outcome !== 'ai_verified'),
		controlPassRate: rate(controls, (d) => d.outcome === 'ai_verified'),
		details
	};
}

export function formatRetrievalReport(r: RetrievalReport): string {
	const lines = ['Retrieval recall@5'];
	for (const [method, m] of Object.entries(r.methods)) {
		lines.push(`  ${method.padEnd(8)} ${(m!.recallAt5 * 100).toFixed(0)}%  ` + m!.byPair.map((p) => `${p.pair}: ${p.hits}/${p.positives}`).join('  '));
		if (m!.missed.length) lines.push(`           missed: ${m!.missed.join(', ')}`);
	}
	if (r.endToEnd) lines.push(`  end-to-end (real thresholds) ${(r.endToEnd.recall * 100).toFixed(0)}%` + (r.endToEnd.missed.length ? `  missed: ${r.endToEnd.missed.join(', ')}` : ''));
	lines.push(`  negatives correctly empty: ${r.negatives.correctlyEmpty}/${r.negatives.total}` + (r.negatives.falsePositives.length ? `  (false positives: ${r.negatives.falsePositives.join(', ')})` : ''));
	if (r.vectorThreshold) {
		const t = r.vectorThreshold;
		lines.push(`  cosine: worst positive ${t.positiveMin.toFixed(3)}, best negative ${t.negativeMax.toFixed(3)} -> ${t.suggested === null ? 'RANGES OVERLAP: no safe RAG_VECTOR_MIN, rely on lexical support' : `suggested RAG_VECTOR_MIN=${t.suggested}`}`);
	}
	return lines.join('\n');
}

export function formatAuditorReport(r: AuditorReport): string {
	return [
		'Auditor evaluation',
		`  deterministic catch rate (fabricated quote / misattribution): ${(r.deterministicCatchRate * 100).toFixed(0)}%`,
		`  LLM catch rate (off-doctrine / overreach):                    ${(r.llmCatchRate * 100).toFixed(0)}%`,
		`  sound controls verified:                                      ${(r.controlPassRate * 100).toFixed(0)}%`,
		...r.details.map((d) => `    ${d.id.padEnd(26)} ${d.outcome}`)
	].join('\n');
}
