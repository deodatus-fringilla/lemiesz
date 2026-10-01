import { json, type RequestHandler } from '@sveltejs/kit';
import { human, setReview, ReviewTransitionError, REVIEW_STATES, type Review } from '$lib/server/review';
import { isStorableLocale } from '$lib/i18n/locales';

/**
 * Human review decision for one language's text: approve, flag, or send back to draft.
 * The actor is always the signed-in user; `ai_verified` / `stale` can only be set by the pipeline.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const id = Number(params.id);
	const body = await request.json().catch(() => null);
	if (
		!Number.isInteger(id) ||
		!body ||
		!isStorableLocale(body.locale) ||
		!(REVIEW_STATES as readonly string[]).includes(body.to)
	) {
		return json({ error: 'Body needs "locale" and "to"' }, { status: 400 });
	}
	try {
		setReview(
			'source',
			id,
			body.locale,
			body.to as Review,
			human(locals.user!.username),
			typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'manual review'
		);
		return json({ success: true });
	} catch (err) {
		const status = err instanceof ReviewTransitionError ? 403 : 500;
		return json({ error: (err as Error).message }, { status });
	}
};
