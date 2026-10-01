import type { Review } from '$lib/server/review';

/**
 * Trust tiers (plan §7.4). Enforced in the retrieval layer, so no UI bug can leak unreviewed content:
 *
 * | review          | Shield                        | Content Engine (public output)          |
 * | human_approved  | yes                           | yes                                     |
 * | ai_verified     | yes, with a visible badge     | NO by default; explicit override → watermark |
 * | flagged / draft / stale | no, unless "include drafts" | no                               |
 */
export type UseContext = 'shield' | 'content';

export interface TrustOptions {
	/** Shield only: also show draft / flagged / stale cards (they are badged in the UI). */
	includeDrafts?: boolean;
	/** Content Engine only: explicit override to allow ai_verified cards. Outputs must then be watermarked. */
	allowAiVerifiedInContent?: boolean;
}

export function allowedReviews(context: UseContext, opts: TrustOptions = {}): Review[] {
	if (context === 'content') {
		return opts.allowAiVerifiedInContent ? ['human_approved', 'ai_verified'] : ['human_approved'];
	}
	return opts.includeDrafts
		? ['human_approved', 'ai_verified', 'draft', 'flagged', 'stale']
		: ['human_approved', 'ai_verified'];
}

export function isAllowed(review: Review, context: UseContext, opts: TrustOptions = {}): boolean {
	return allowedReviews(context, opts).includes(review);
}

/** True when any card behind a piece of output is not human-approved: the output must be watermarked. */
export function needsWatermark(reviews: Review[]): boolean {
	return reviews.some((r) => r !== 'human_approved');
}
