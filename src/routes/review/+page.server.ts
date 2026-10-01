import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { reviewQueue, sampleStats } from '$lib/server/pipeline/queue';
import { REVIEW_STATES, ReviewTransitionError, human, setReview, type OwnerType, type Review } from '$lib/server/review';
import { isStorableLocale } from '$lib/i18n/locales';
import { getEmbedder } from '$lib/server/llm/embedder';
import { reindexAll } from '$lib/server/rag/vectors';

export const load: PageServerLoad = ({ locals }) => ({
	queue: reviewQueue(),
	stats: sampleStats(),
	isAdmin: locals.user?.role === 'admin'
});

export const actions: Actions = {
	review: async ({ request, locals }) => {
		const d = await request.formData();
		const type = String(d.get('ownerType'));
		const id = Number(d.get('ownerId'));
		const locale = String(d.get('locale'));
		const to = String(d.get('to'));
		if ((type !== 'source' && type !== 'argument') || !Number.isInteger(id) || !isStorableLocale(locale) || !(REVIEW_STATES as readonly string[]).includes(to)) {
			return fail(400, { errors: ['Invalid request'] });
		}
		try {
			setReview(type as OwnerType, id, locale, to as Review, human(locals.user!.username), 'review queue');
			return { ok: true };
		} catch (e) {
			return fail(e instanceof ReviewTransitionError ? 403 : 500, { errors: [(e as Error).message] });
		}
	},

	reindex: async ({ locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { errors: ['Admin only'] });
		const embedder = await getEmbedder();
		if (!embedder) return { reindexed: null };
		return { reindexed: await reindexAll(embedder) };
	}
};
