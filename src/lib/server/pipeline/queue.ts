import crypto from 'node:crypto';
import { db } from '$lib/server/db';
import type { OwnerType } from '$lib/server/review';

/** Share of `ai_verified` cards routed to a human for spot-checking (plan §7.3). */
export const SAMPLE_PERCENT = Number(process.env.REVIEW_SAMPLE_PERCENT ?? 10);
/** Human disagreement rate above which the auditor prompt/model is treated as broken. */
export const DISAGREEMENT_ALERT = Number(process.env.REVIEW_DISAGREEMENT_ALERT ?? 0.2);
export const MIN_SAMPLES_FOR_ALERT = 5;

/** Stable, reproducible sampling: a card is either always in the sample or never. */
export function isSampled(ownerType: OwnerType, ownerId: number, locale: string, percent = SAMPLE_PERCENT): boolean {
	const h = crypto.createHash('sha256').update(`${ownerType}:${ownerId}:${locale}`).digest();
	return h.readUInt16BE(0) % 100 < percent;
}

export type QueueReason = 'flagged' | 'stale' | 'draft' | 'sampled';

export interface QueueItem {
	ownerType: OwnerType;
	ownerId: number;
	locale: string;
	review: string;
	reason: QueueReason;
	title: string;
	body: string;
	uses: number;
	auditNotes: string | null;
}

const REASON_ORDER: Record<QueueReason, number> = { flagged: 0, stale: 1, sampled: 2, draft: 3 };

/**
 * The human worklist: flagged, stale and draft texts, plus the sampled share of ai_verified cards.
 * Ordered by reason, then by how often the card is actually used (highest impact first).
 */
export function reviewQueue(): QueueItem[] {
	const usage = new Map(
		(db.prepare('SELECT owner_type, owner_id, uses FROM card_usage').all() as { owner_type: string; owner_id: number; uses: number }[]).map(
			(r) => [`${r.owner_type}:${r.owner_id}`, r.uses]
		)
	);
	const items: QueueItem[] = [];

	const sources = db
		.prepare(
			`SELECT st.source_id AS id, st.locale, st.review, st.text, st.audit_notes, s.work || ' ' || s.section_ref AS title
			 FROM source_texts st JOIN sources s ON s.id = st.source_id WHERE st.review != 'human_approved'`
		)
		.all() as { id: number; locale: string; review: string; text: string; audit_notes: string | null; title: string }[];
	for (const r of sources) {
		const reason = classify('source', r.id, r.locale, r.review);
		if (reason) items.push({ ownerType: 'source', ownerId: r.id, locale: r.locale, review: r.review, reason, title: r.title, body: r.text, uses: usage.get(`source:${r.id}`) ?? 0, auditNotes: r.audit_notes });
	}

	const args = db
		.prepare(
			`SELECT argument_id AS id, locale, review, opponent_claim, counter_punch, audit_notes FROM argument_texts WHERE review != 'human_approved'`
		)
		.all() as { id: number; locale: string; review: string; opponent_claim: string; counter_punch: string; audit_notes: string | null }[];
	for (const r of args) {
		const reason = classify('argument', r.id, r.locale, r.review);
		if (reason) items.push({ ownerType: 'argument', ownerId: r.id, locale: r.locale, review: r.review, reason, title: r.opponent_claim, body: r.counter_punch, uses: usage.get(`argument:${r.id}`) ?? 0, auditNotes: r.audit_notes });
	}

	return items.sort(
		(a, b) => REASON_ORDER[a.reason] - REASON_ORDER[b.reason] || b.uses - a.uses || a.ownerId - b.ownerId
	);
}

function classify(type: OwnerType, id: number, locale: string, review: string): QueueReason | null {
	if (review === 'flagged') return 'flagged';
	if (review === 'stale') return 'stale';
	if (review === 'draft') return 'draft';
	if (review === 'ai_verified' && isSampled(type, id, locale)) return 'sampled';
	return null;
}

export interface SampleStats {
	reviewed: number;
	agreed: number;
	disagreed: number;
	rate: number;
	alert: boolean;
}

/**
 * How often a human overturns the auditor on sampled cards: agreement = human_approved, disagreement =
 * sent back to draft or flagged. A high rate means the auditor prompt or model is not trustworthy.
 */
export function sampleStats(): SampleStats {
	const events = db
		.prepare(
			`SELECT owner_type, owner_id, locale, to_review FROM review_events
			 WHERE from_review = 'ai_verified' AND actor LIKE 'human:%'`
		)
		.all() as { owner_type: OwnerType; owner_id: number; locale: string; to_review: string }[];
	let agreed = 0;
	let disagreed = 0;
	for (const e of events) {
		if (!isSampled(e.owner_type, e.owner_id, e.locale)) continue;
		if (e.to_review === 'human_approved') agreed++;
		else if (e.to_review === 'draft' || e.to_review === 'flagged') disagreed++;
	}
	const reviewed = agreed + disagreed;
	const rate = reviewed === 0 ? 0 : disagreed / reviewed;
	return { reviewed, agreed, disagreed, rate, alert: reviewed >= MIN_SAMPLES_FOR_ALERT && rate > DISAGREEMENT_ALERT };
}
