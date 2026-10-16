import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { reviewQueue, sampleStats } from '$lib/server/pipeline/queue';
import { REVIEW_STATES, ReviewTransitionError, human, setReview, type OwnerType, type Review } from '$lib/server/review';
import { isStorableLocale } from '$lib/i18n/locales';
import { getEmbedder } from '$lib/server/llm/embedder';
import { reindexAll } from '$lib/server/rag/vectors';
import { listMedia, setMediaStatus, type MediaStatus } from '$lib/server/media';
import { listPosters, setPosterStatus } from '$lib/server/posters';

export interface SpanPreview {
	sourceId: number;
	sourceTitle: string;
	sourceText: string;
	span: string;
}

export const load: PageServerLoad = ({ locals }) => {
	const rawQueue = reviewQueue();

	// Enrich argument queue items with their supporting spans and linked source texts for inline quote verification.
	const queue = rawQueue.map((item) => {
		let spans: SpanPreview[] = [];
		if (item.ownerType === 'argument') {
			const row = db
				.prepare('SELECT supporting_spans_json FROM argument_texts WHERE argument_id = ? AND locale = ?')
				.get(item.ownerId, item.locale) as { supporting_spans_json: string | null } | undefined;
			const parsed = row?.supporting_spans_json
				? (JSON.parse(row.supporting_spans_json) as { source_id: number; span: string }[])
				: [];

			const linkedSources = db
				.prepare(
					`SELECT s.id, s.work || ' ' || s.section_ref AS title,
						COALESCE(
							(SELECT st.text FROM source_texts st WHERE st.source_id = s.id AND st.locale = ?),
							(SELECT st.text FROM source_texts st WHERE st.source_id = s.id ORDER BY st.locale LIMIT 1),
							''
						) AS text
					 FROM argument_sources l
					 JOIN sources s ON s.id = l.source_id
					 WHERE l.argument_id = ?`
				)
				.all(item.locale, item.ownerId) as { id: number; title: string; text: string }[];

			if (parsed.length > 0) {
				spans = parsed.map((p) => {
					const found = linkedSources.find((s) => s.id === p.source_id) ?? linkedSources[0];
					return {
						sourceId: p.source_id,
						sourceTitle: found?.title ?? `#${p.source_id}`,
						sourceText: found?.text ?? '',
						span: p.span
					};
				});
			} else if (linkedSources.length > 0) {
				spans = linkedSources.map((s) => ({
					sourceId: s.id,
					sourceTitle: s.title,
					sourceText: s.text,
					span: ''
				}));
			}
		}
		return { ...item, spans };
	});

	const pendingMedia = listMedia().filter((m) => m.status !== 'human_approved');
	const pendingPosters = listPosters().filter((p) => p.status !== 'human_approved');

	return {
		queue,
		pendingMedia,
		pendingPosters,
		stats: sampleStats(),
		isAdmin: locals.user?.role === 'admin'
	};
};

export const actions: Actions = {
	review: async ({ request, locals }) => {
		const d = await request.formData();
		const type = String(d.get('ownerType'));
		const id = Number(d.get('ownerId'));
		const locale = String(d.get('locale'));
		const to = String(d.get('to'));
		if (
			(type !== 'source' && type !== 'argument') ||
			!Number.isInteger(id) ||
			!isStorableLocale(locale) ||
			!(REVIEW_STATES as readonly string[]).includes(to)
		) {
			return fail(400, { errors: ['Invalid request'] });
		}
		try {
			setReview(type as OwnerType, id, locale, to as Review, human(locals.user!.username), 'review queue');
			return { ok: true };
		} catch (e) {
			return fail(e instanceof ReviewTransitionError ? 403 : 500, { errors: [(e as Error).message] });
		}
	},

	batchApprove: async ({ request, locals }) => {
		const d = await request.formData();
		const keys = d.getAll('selected_items').map((v) => String(v));
		const actor = human(locals.user!.username);
		let approvedCount = 0;
		const errors: string[] = [];

		for (const key of keys) {
			const [type, idStr, locale] = key.split(':');
			const id = Number(idStr);
			if ((type !== 'source' && type !== 'argument') || !Number.isInteger(id) || !isStorableLocale(locale)) continue;
			try {
				// If a source is in 'draft' state, verify or approve it cleanly according to review transition rules
				setReview(type as OwnerType, id, locale, 'human_approved', actor, 'batch review queue approval');
				approvedCount++;
			} catch (e) {
				errors.push((e as Error).message);
			}
		}
		if (errors.length && approvedCount === 0) return fail(400, { errors });
		return { ok: true, approvedCount };
	},

	mediaStatus: async ({ request, locals }) => {
		const d = await request.formData();
		const mediaId = Number(d.get('mediaId'));
		const to = String(d.get('to')) as MediaStatus;
		if (!Number.isInteger(mediaId) || mediaId <= 0) return fail(400, { errors: ['Invalid media item'] });
		try {
			setMediaStatus(mediaId, to, human(locals.user!.username));
			return { ok: true };
		} catch (e) {
			return fail(400, { errors: [(e as Error).message] });
		}
	},

	posterStatus: async ({ request, locals }) => {
		const d = await request.formData();
		const posterId = Number(d.get('posterId'));
		const to = String(d.get('to')) as MediaStatus;
		if (!Number.isInteger(posterId) || posterId <= 0) return fail(400, { errors: ['Invalid poster'] });
		try {
			setPosterStatus(posterId, to, human(locals.user!.username));
			return { ok: true };
		} catch (e) {
			return fail(400, { errors: [(e as Error).message] });
		}
	},

	reindex: async ({ locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { errors: ['Admin only'] });
		const embedder = await getEmbedder();
		if (!embedder) return { reindexed: null };
		return { reindexed: await reindexAll(embedder) };
	}
};
