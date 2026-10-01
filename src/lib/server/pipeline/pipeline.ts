import { db } from '$lib/server/db';
import { assertIndependent, getProvider } from '$lib/server/llm';
import type { LlmProvider } from '$lib/server/llm/provider';
import { PROMPT_VERSION } from './prompts';
import { auditCard, type AuditOutcome } from './auditor';
import { draftCards, type DraftResult } from './drafter';

export interface PipelineSummary {
	created: number;
	rejected: number;
	verified: number;
	flagged: number;
	errors: number;
	draft: DraftResult;
	audits: AuditOutcome[];
}

/**
 * Drafter → span check → independent Auditor for one or more sources (plan §7.1).
 * Both providers must be configured and belong to different model families.
 */
export async function runDraftAndAudit(args: {
	sourceIds: number[];
	locale: string;
	count?: number;
	actor: string;
	drafter?: LlmProvider | null;
	auditor?: LlmProvider | null;
}): Promise<PipelineSummary> {
	const drafter = args.drafter ?? getProvider('drafter');
	const auditor = args.auditor ?? getProvider('auditor');
	if (!drafter || !auditor) {
		throw new Error('Drafter and auditor models are not configured (LLM_DRAFTER_* and LLM_AUDITOR_*).');
	}
	assertIndependent(drafter, auditor);

	const draft = await draftCards({ provider: drafter, sourceIds: args.sourceIds, locale: args.locale, count: args.count });
	const audits: AuditOutcome[] = [];
	for (const id of draft.created) {
		audits.push(await auditCard({ provider: auditor, argumentId: id, locale: args.locale }));
	}

	const summary: PipelineSummary = {
		created: draft.created.length,
		rejected: draft.rejected.length,
		verified: audits.filter((a) => a.result === 'ai_verified').length,
		flagged: audits.filter((a) => a.result === 'flagged').length,
		errors: audits.filter((a) => a.result === 'error').length,
		draft,
		audits
	};
	db.prepare(
		`INSERT INTO pipeline_runs (kind, source_id, actor, drafter_model, auditor_model, prompt_version,
			created_count, rejected_count, verified_count, flagged_count, notes)
		 VALUES ('draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		args.sourceIds[0] ?? null,
		args.actor,
		drafter.id,
		auditor.id,
		PROMPT_VERSION,
		summary.created,
		summary.rejected,
		summary.verified,
		summary.flagged,
		draft.rejected.map((r) => `${r.opponent_claim.slice(0, 60)}: ${r.failures.map((f) => f.reason).join(',')}`).join(' | ') || null
	);
	return summary;
}

/** Re-audits every `stale` card text (after a source, prompt or auditor change). */
export async function reauditStale(auditor: LlmProvider): Promise<AuditOutcome[]> {
	const rows = db.prepare("SELECT argument_id AS id, locale FROM argument_texts WHERE review = 'stale'").all() as {
		id: number;
		locale: string;
	}[];
	const out: AuditOutcome[] = [];
	for (const r of rows) out.push(await auditCard({ provider: auditor, argumentId: r.id, locale: r.locale }));
	return out;
}
