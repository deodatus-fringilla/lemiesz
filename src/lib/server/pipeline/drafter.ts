import { db } from '$lib/server/db';
import { createArgument, type SupportingSpan } from '$lib/server/arguments';
import type { LlmProvider } from '$lib/server/llm/provider';
import { system } from '$lib/server/review';
import { PROMPT_VERSION, drafterRequest, type PromptSource } from './prompts';
import { verifySpans, type SpanFailure } from './spancheck';

interface RawCard {
	opponent_claim: string;
	counter_punch: string;
	fallacy_type: string | null;
	core_principle: string;
	keywords: string | null;
	supporting_spans: SupportingSpan[];
}

const nonEmpty = (v: unknown, name: string): string => {
	if (typeof v !== 'string' || !v.trim()) throw new Error(`"${name}" must be a non-empty string`);
	return v.trim();
};

/** Validates the Drafter's JSON. Throws on structural problems so the provider can retry once. */
export function parseDrafterOutput(raw: unknown): RawCard[] {
	const cards = (raw as { cards?: unknown })?.cards;
	if (!Array.isArray(cards)) throw new Error('Expected {"cards": [...]}');
	return cards.map((c: Record<string, unknown>, i) => {
		const spans = c.supporting_spans;
		if (!Array.isArray(spans)) throw new Error(`card ${i}: "supporting_spans" must be an array`);
		return {
			opponent_claim: nonEmpty(c.opponent_claim, 'opponent_claim'),
			counter_punch: nonEmpty(c.counter_punch, 'counter_punch'),
			fallacy_type: typeof c.fallacy_type === 'string' && c.fallacy_type.trim() ? c.fallacy_type.trim() : null,
			core_principle: nonEmpty(c.core_principle, 'core_principle'),
			keywords: typeof c.keywords === 'string' && c.keywords.trim() ? c.keywords.trim() : null,
			supporting_spans: spans.map((s: Record<string, unknown>) => ({
				source_id: Number(s.source_id),
				span: typeof s.span === 'string' ? s.span : ''
			}))
		};
	});
}

export interface DraftResult {
	created: number[];
	rejected: { opponent_claim: string; failures: SpanFailure[] }[];
}

/** Picks the text to show the drafter for a source: prefer the card language, else the original, else any. */
function promptSources(sourceIds: number[], locale: string): PromptSource[] {
	const out: PromptSource[] = [];
	for (const id of sourceIds) {
		const s = db.prepare('SELECT work, section_ref, original_locale FROM sources WHERE id = ?').get(id) as
			| { work: string; section_ref: string; original_locale: string }
			| undefined;
		if (!s) throw new Error(`Source ${id} not found`);
		const rows = db.prepare('SELECT locale, text FROM source_texts WHERE source_id = ?').all(id) as { locale: string; text: string }[];
		const row = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === s.original_locale) ?? rows[0];
		if (!row) throw new Error(`Source ${id} has no text`);
		out.push({ id, label: `${s.work} ${s.section_ref}`, text: row.text });
	}
	return out;
}

/**
 * Asks the Drafter for argument cards grounded in the given sources, runs the deterministic span check
 * on every card, and stores the survivors as `draft` / `ai_drafted`. Cards whose quotes are not
 * verbatim in the source never reach the database (plan §7.1).
 */
export async function draftCards(args: {
	provider: LlmProvider;
	sourceIds: number[];
	locale: string;
	count?: number;
}): Promise<DraftResult> {
	const sources = promptSources(args.sourceIds, args.locale);
	const cards = await args.provider.structured(
		drafterRequest({ locale: args.locale, sources, count: args.count ?? 3 }),
		parseDrafterOutput
	);

	const result: DraftResult = { created: [], rejected: [] };
	for (const card of cards) {
		const check = verifySpans(card.supporting_spans, args.sourceIds);
		if (!check.ok) {
			result.rejected.push({ opponent_claim: card.opponent_claim, failures: check.failures });
			continue;
		}
		const id = createArgument(
			{
				locale: args.locale,
				opponent_claim: card.opponent_claim,
				counter_punch: card.counter_punch,
				fallacy_type: card.fallacy_type,
				core_principle: card.core_principle,
				keywords: card.keywords,
				source_ids: args.sourceIds,
				origin: 'ai_drafted',
				spans: card.supporting_spans,
				reason: `drafted by ${args.provider.id}`
			},
			system('drafter'),
			{ drafter_model: args.provider.id, prompt_version: PROMPT_VERSION }
		);
		result.created.push(id);
	}
	return result;
}
