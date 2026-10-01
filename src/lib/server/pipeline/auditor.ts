import { db } from '$lib/server/db';
import {
	getArgument,
	getLinkedSourceIds,
	type ArgumentTextRecord,
	type SupportingSpan
} from '$lib/server/arguments';
import type { LlmProvider } from '$lib/server/llm/provider';
import { setReview, system } from '$lib/server/review';
import { loadDoctrine } from './doctrine';
import { PROMPT_VERSION, auditorRequest, type PromptSource } from './prompts';
import { verifySpans } from './spancheck';

export type Verdict = 'pass' | 'fail' | 'unsure';
export interface Criterion {
	verdict: Verdict;
	reason: string;
}
export interface AuditVerdict {
	source_fidelity: Criterion;
	doctrinal_alignment: Criterion;
	terminology: Criterion;
	rhetorical_efficacy: { note: string };
}

/** Criteria that gate `ai_verified`. Rhetorical efficacy is advisory and never gates (plan §12.3 w). */
export const GATING = ['source_fidelity', 'doctrinal_alignment', 'terminology'] as const;

function parseCriterion(v: unknown, name: string): Criterion {
	const o = v as { verdict?: unknown; reason?: unknown };
	if (!o || !['pass', 'fail', 'unsure'].includes(o.verdict as string)) {
		throw new Error(`"${name}.verdict" must be pass, fail or unsure`);
	}
	return { verdict: o.verdict as Verdict, reason: typeof o.reason === 'string' ? o.reason : '' };
}

export function parseAuditVerdict(raw: unknown): AuditVerdict {
	const r = raw as Record<string, unknown>;
	const note = (r?.rhetorical_efficacy as { note?: unknown } | undefined)?.note;
	return {
		source_fidelity: parseCriterion(r?.source_fidelity, 'source_fidelity'),
		doctrinal_alignment: parseCriterion(r?.doctrinal_alignment, 'doctrinal_alignment'),
		terminology: parseCriterion(r?.terminology, 'terminology'),
		rhetorical_efficacy: { note: typeof note === 'string' ? note : '' }
	};
}

/** Pass/fail rubric: all three gating criteria must be an explicit `pass`; anything else means `flagged`. */
export function decide(v: AuditVerdict): 'ai_verified' | 'flagged' {
	return GATING.every((k) => v[k].verdict === 'pass') ? 'ai_verified' : 'flagged';
}

export interface AuditOutcome {
	argumentId: number;
	locale: string;
	result: 'ai_verified' | 'flagged' | 'error';
	reason: string;
}

function promptSourcesFor(sourceIds: number[]): PromptSource[] {
	const out: PromptSource[] = [];
	for (const id of sourceIds) {
		const s = db.prepare('SELECT work, section_ref FROM sources WHERE id = ?').get(id) as
			| { work: string; section_ref: string }
			| undefined;
		if (!s) continue;
		for (const t of db.prepare('SELECT locale, text FROM source_texts WHERE source_id = ?').all(id) as {
			locale: string;
			text: string;
		}[]) {
			out.push({ id, label: `${s.work} ${s.section_ref} [${t.locale}]`, text: t.text });
		}
	}
	return out;
}

/**
 * Audits one card text that is `draft` (or `stale`). Order matters (plan §7.1): the deterministic span
 * check runs first and a failure flags the card without spending an LLM call; only then does the
 * independent Auditor judge it. Any LLM/validation error leaves the card a draft (fail closed).
 */
export async function auditCard(args: {
	provider: LlmProvider;
	argumentId: number;
	locale: string;
	doctrine?: string;
}): Promise<AuditOutcome> {
	const { argumentId, locale, provider } = args;
	const fail = (reason: string): AuditOutcome => ({ argumentId, locale, result: 'error', reason });

	const arg = getArgument(argumentId, locale);
	const text: ArgumentTextRecord | undefined = arg?.texts[locale];
	if (!arg || !text) return fail('card text not found');
	if (text.review !== 'draft' && text.review !== 'stale') return fail(`card is ${text.review}, not auditable`);

	const spans: SupportingSpan[] = text.supporting_spans_json ? JSON.parse(text.supporting_spans_json) : [];
	const sourceIds = getLinkedSourceIds(argumentId);

	const record = (verdict: AuditVerdict | null, notes: string) => {
		db.prepare(
			`UPDATE argument_texts SET audit_json = ?, audit_notes = ?, auditor_model = ?, prompt_version = ?, audited_at = datetime('now')
			 WHERE argument_id = ? AND locale = ?`
		).run(verdict ? JSON.stringify(verdict) : null, notes, provider.id, PROMPT_VERSION, argumentId, locale);
	};

	const spanCheck = verifySpans(spans, sourceIds);
	if (!spanCheck.ok) {
		const notes = `Deterministic span check failed: ${spanCheck.failures.map((f) => `${f.reason} (source ${f.source_id})`).join('; ')}`;
		record(null, notes);
		setReview('argument', argumentId, locale, 'flagged', system('span-check'), notes);
		return { argumentId, locale, result: 'flagged', reason: notes };
	}

	let verdict: AuditVerdict;
	try {
		verdict = await provider.structured(
			auditorRequest({
				locale,
				card: {
					opponent_claim: text.opponent_claim,
					counter_punch: text.counter_punch,
					core_principle: arg.core_principle,
					fallacy_type: arg.fallacy_type
				},
				spans,
				sources: promptSourcesFor(sourceIds),
				doctrine: args.doctrine ?? loadDoctrine()
			}),
			parseAuditVerdict
		);
	} catch (e) {
		return fail(`auditor error: ${(e as Error).message}`);
	}

	const outcome = decide(verdict);
	const notes = [
		...GATING.filter((k) => verdict[k].verdict !== 'pass').map((k) => `${k}: ${verdict[k].verdict} — ${verdict[k].reason}`),
		verdict.rhetorical_efficacy.note ? `efficacy (advisory): ${verdict.rhetorical_efficacy.note}` : ''
	]
		.filter(Boolean)
		.join('\n');
	record(verdict, notes);
	setReview('argument', argumentId, locale, outcome, system(`auditor:${provider.id}`), outcome === 'ai_verified' ? 'audit passed' : 'audit did not pass');
	return { argumentId, locale, result: outcome, reason: notes };
}
