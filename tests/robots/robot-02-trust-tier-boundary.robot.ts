import { describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { retrieve } from '$lib/server/rag/retrieve';
import { allowedReviews, needsWatermark } from '$lib/server/rag/trust';
import { ReviewTransitionError, human, setReview, system } from '$lib/server/review';
import { upsertSourceText } from '$lib/server/sources';
import { makeArgument, makeSource } from '$lib/server/testing';

// ROBOT-02 — The Trust-Tier Write Boundary (docs/17_Robots/ROBOT-02-trust-tier-write-boundary.md).
// Wraps rag/trust.ts, review.ts and the trust filter inside retrieval. Do not weaken an assertion to make it pass.

const reviewOf = (type: 'source' | 'argument', id: number) =>
	(db.prepare(`SELECT review FROM ${type}_texts WHERE ${type}_id = ? AND locale = 'en'`).get(id) as { review: string }).review;

describe('ROBOT-02 · public output only ever sees human-approved cards', () => {
	it('fixture: 1 human_approved + 1 ai_verified + 1 draft card; content retrieval returns exactly the approved one', async () => {
		const src = makeSource({ work: 'Fleet Test Treaty', section_ref: 'Art. 1', text: 'Quartzite harbours remain inviolable during every regional emergency.' });
		const q = 'quartzite harbours inviolable regional emergency';
		const mk = (review: 'human_approved' | 'ai_verified' | 'draft') =>
			makeArgument(
				{
					source_ids: [src],
					opponent_claim: `Quartzite harbours inviolable regional emergency attack ${review}`,
					counter_punch: `Quartzite harbours inviolable regional emergency reply ${review}`
				},
				review
			);
		const approved = mk('human_approved');
		const ai = mk('ai_verified');
		const draft = mk('draft');

		const byDefault = await retrieve({ query: q, context: 'content', embedder: null });
		const ids = byDefault.arguments.map((a) => a.id);
		expect(ids).toContain(approved);
		expect(ids).not.toContain(ai);
		expect(ids).not.toContain(draft);
		expect(byDefault.watermark).toBe(false);

		const override = await retrieve({ query: q, context: 'content', embedder: null, trust: { allowAiVerifiedInContent: true } });
		expect(override.arguments.map((a) => a.id)).toContain(ai);
		expect(override.arguments.map((a) => a.id)).not.toContain(draft);
		expect(override.watermark).toBe(true); // the override is never silent
	});

	it('policy table: content = approved only; override adds ai_verified; draft/flagged/stale never reach content', () => {
		expect(allowedReviews('content')).toEqual(['human_approved']);
		expect(allowedReviews('content', { allowAiVerifiedInContent: true })).toEqual(['human_approved', 'ai_verified']);
		for (const r of ['draft', 'flagged', 'stale'] as const) {
			expect(allowedReviews('content', { allowAiVerifiedInContent: true, includeDrafts: true })).not.toContain(r);
		}
		expect(needsWatermark(['human_approved', 'ai_verified'])).toBe(true);
		expect(needsWatermark(['human_approved'])).toBe(false);
	});
});

describe('ROBOT-02 · only a signed-in human grants approval; only the pipeline grants ai_verified', () => {
	it('a system actor cannot set human_approved', () => {
		const id = makeArgument({ source_ids: [makeSource()] }, 'draft');
		expect(() => setReview('argument', id, 'en', 'human_approved', system('pipeline'), 'x')).toThrow(ReviewTransitionError);
		expect(reviewOf('argument', id)).toBe('draft');
	});

	it('a human actor cannot set ai_verified or stale', () => {
		const id = makeArgument({ source_ids: [makeSource()] }, 'draft');
		expect(() => setReview('argument', id, 'en', 'ai_verified', human('alice'), 'x')).toThrow(ReviewTransitionError);
		expect(() => setReview('argument', id, 'en', 'stale', human('alice'), 'x')).toThrow(ReviewTransitionError);
		expect(reviewOf('argument', id)).toBe('draft');
	});

	it('a human can approve, and the audit trail names the human', () => {
		const id = makeArgument({ source_ids: [makeSource()] }, 'draft');
		setReview('argument', id, 'en', 'human_approved', human('alice'), 'read and checked');
		expect(reviewOf('argument', id)).toBe('human_approved');
		const ev = db.prepare("SELECT actor FROM review_events WHERE owner_type='argument' AND owner_id=? ORDER BY id DESC").get(id) as { actor: string };
		expect(ev.actor).toBe('human:alice');
	});

	it('editing a source text resets it to draft and turns dependent ai_verified AND human_approved cards stale', () => {
		const src = makeSource({ text: 'Original wording of the treaty article, long enough to be a span.' }, 'human_approved');
		const ai = makeArgument({ source_ids: [src] }, 'ai_verified');
		const approved = makeArgument({ source_ids: [src] }, 'human_approved');
		const draft = makeArgument({ source_ids: [src] }, 'draft');
		upsertSourceText(src, 'en', { text: 'Edited wording of the treaty article, long enough to be a span.' }, human('alice'));
		expect(reviewOf('source', src)).toBe('draft');
		expect(reviewOf('argument', ai)).toBe('stale');
		expect(reviewOf('argument', approved)).toBe('stale');
		expect(reviewOf('argument', draft)).toBe('draft'); // nothing to invalidate
	});
});
