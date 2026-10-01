import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { DraftError, deleteDraft, getDraft, listDrafts, markReviewed, updateBody } from '$lib/server/content/drafts';
import { PLATFORMS, TONES, DEFAULT_TONE } from '$lib/server/content/formats';
import { MAX_BRIEF_CHARS } from '$lib/server/content/generate';
import { getProvider } from '$lib/server/llm';

export const load: PageServerLoad = ({ url }) => {
	const id = Number(url.searchParams.get('d'));
	return {
		draft: Number.isInteger(id) && id > 0 ? getDraft(id) : null,
		recent: listDrafts(15),
		platforms: [...PLATFORMS],
		tones: [...TONES],
		defaultTones: DEFAULT_TONE,
		maxBrief: MAX_BRIEF_CHARS,
		chatConfigured: !!getProvider('chat'),
		secondReviewer: process.env.CONTENT_REQUIRE_SECOND_REVIEWER === 'true'
	};
};

const idOf = (d: FormData) => {
	const n = Number(d.get('draftId'));
	return Number.isInteger(n) && n > 0 ? n : null;
};

export const actions: Actions = {
	/** Saves the edited text. Any edit clears "reviewed" and re-runs the checks. */
	save: async ({ request }) => {
		const d = await request.formData();
		const id = idOf(d);
		if (!id) return fail(400, { action: 'save', errors: ['Missing draft'] });
		try {
			updateBody(id, String(d.get('body') ?? ''));
			return { action: 'save', draftId: id };
		} catch (e) {
			return fail(400, { action: 'save', errors: [(e as Error).message] });
		}
	},

	/** A human takes responsibility for the text on screen: it is saved first, then marked reviewed. */
	review: async ({ request, locals }) => {
		const d = await request.formData();
		const id = idOf(d);
		if (!id) return fail(400, { action: 'review', errors: ['Missing draft'] });
		try {
			const body = String(d.get('body') ?? '').trim();
			const current = getDraft(id);
			if (current && body && body !== current.body.trim()) updateBody(id, body);
			markReviewed(id, locals.user!.username);
			return { action: 'review', draftId: id };
		} catch (e) {
			return fail(e instanceof DraftError ? 403 : 500, { action: 'review', errors: [(e as Error).message] });
		}
	},

	delete: async ({ request, locals }) => {
		const id = idOf(await request.formData());
		if (!id) return fail(400, { action: 'delete', errors: ['Missing draft'] });
		const draft = getDraft(id);
		if (draft && locals.user?.role !== 'admin' && draft.created_by !== locals.user?.username) {
			return fail(403, { action: 'delete', errors: ['Only the author or an admin can delete a draft'] });
		}
		deleteDraft(id);
		return { action: 'delete' };
	}
};
