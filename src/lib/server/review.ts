import { db } from '$lib/server/db';

export const REVIEW_STATES = ['draft', 'flagged', 'ai_verified', 'human_approved', 'stale'] as const;
export type Review = (typeof REVIEW_STATES)[number];

export const ORIGINS = [
	'original',
	'official_translation',
	'human_translation',
	'machine_translation',
	'ai_drafted',
	'paraphrase'
] as const;
export type Origin = (typeof ORIGINS)[number];

export type OwnerType = 'source' | 'argument';

/**
 * Who is making a change. `human` actors come only from an authenticated session (never from a
 * request body). `system` actors are the pipeline scripts. Plan §3.3: only a human can set
 * `human_approved`, and only the pipeline can set `ai_verified` / `stale`.
 */
export type Actor = { kind: 'human'; name: string } | { kind: 'system'; name: string };

export const human = (name: string): Actor => ({ kind: 'human', name });
export const system = (name: string): Actor => ({ kind: 'system', name });

const TABLES: Record<OwnerType, { table: string; idColumn: string }> = {
	source: { table: 'source_texts', idColumn: 'source_id' },
	argument: { table: 'argument_texts', idColumn: 'argument_id' }
};

const HUMAN_TARGETS: readonly Review[] = ['human_approved', 'draft', 'flagged'];
const SYSTEM_TARGETS: readonly Review[] = ['ai_verified', 'flagged', 'stale', 'draft'];

export class ReviewTransitionError extends Error {}

export function canTransition(actor: Actor, from: Review, to: Review): boolean {
	if (from === to) return true;
	if (actor.kind === 'human') return HUMAN_TARGETS.includes(to);
	// System: may verify only content that still needs checking, and may mark verified content stale.
	if (!SYSTEM_TARGETS.includes(to)) return false;
	if (to === 'ai_verified') return from === 'draft' || from === 'stale' || from === 'flagged';
	if (to === 'stale') return from === 'ai_verified' || from === 'human_approved';
	return true;
}

export function recordReviewEvent(
	ownerType: OwnerType,
	ownerId: number,
	locale: string,
	from: Review,
	to: Review,
	actor: Actor,
	reason: string
): void {
	db.prepare(
		`INSERT INTO review_events (owner_type, owner_id, locale, from_review, to_review, actor, reason)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`
	).run(ownerType, ownerId, locale, from, to, `${actor.kind}:${actor.name}`, reason);
}

/** Moves one text row to a new review state, enforcing the trust rules and writing the audit trail. */
export function setReview(
	ownerType: OwnerType,
	ownerId: number,
	locale: string,
	to: Review,
	actor: Actor,
	reason: string
): void {
	const { table, idColumn } = TABLES[ownerType];
	db.transaction(() => {
		const row = db
			.prepare(`SELECT review FROM ${table} WHERE ${idColumn} = ? AND locale = ?`)
			.get(ownerId, locale) as { review: Review } | undefined;
		if (!row) throw new ReviewTransitionError(`No ${ownerType} text ${ownerId}/${locale}`);
		if (!canTransition(actor, row.review, to)) {
			throw new ReviewTransitionError(
				`${actor.kind} "${actor.name}" may not move ${ownerType} ${ownerId}/${locale} from ${row.review} to ${to}`
			);
		}
		if (row.review === to) return;
		db.prepare(`UPDATE ${table} SET review = ? WHERE ${idColumn} = ? AND locale = ?`).run(
			to,
			ownerId,
			locale
		);
		recordReviewEvent(ownerType, ownerId, locale, row.review, to, actor, reason);
	})();
}

/**
 * Called when a canonical source text changes: every AI-verified or human-approved argument card that
 * depends on it becomes `stale` and must be re-audited and re-approved (plan §3.3; extended to approved
 * cards on 2026-10-01 because their quoted spans may no longer match the edited source).
 */
export function markDependentsStale(sourceId: number, reason: string): number {
	const rows = db
		.prepare(
			`SELECT at.argument_id AS id, at.locale AS locale
			 FROM argument_texts at
			 JOIN argument_sources ars ON ars.argument_id = at.argument_id
			 WHERE ars.source_id = ? AND at.review IN ('ai_verified', 'human_approved')`
		)
		.all(sourceId) as { id: number; locale: string }[];
	for (const r of rows) setReview('argument', r.id, r.locale, 'stale', system('source-change'), reason);
	return rows.length;
}
