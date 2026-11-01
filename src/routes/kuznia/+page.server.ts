import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	listDeliberations,
	getDeliberation,
	updateDeliberation,
	addCommentToDeliberation,
	createDeliberation,
	deleteDeliberation
} from '$lib/server/kuznia';
import { db } from '$lib/server/db';

export const load: PageServerLoad = ({ url, locals }) => {
	const deliberations = listDeliberations();
	const idParam = url.searchParams.get('id');
	const selectedId = idParam ? Number(idParam) : (deliberations[0]?.id ?? null);

	// Fetch media assets for the selection dropdown
	const mediaList = db
		.prepare('SELECT id, title, artist_or_author, media_type FROM media_assets ORDER BY title ASC')
		.all() as Array<{ id: number; title: string; artist_or_author: string; media_type: string }>;

	// Fetch sources for the selection dropdown
	const sourcesList = db
		.prepare('SELECT id, work, section_ref FROM sources ORDER BY work ASC')
		.all() as Array<{ id: number; work: string; section_ref: string }>;

	return {
		deliberations,
		selectedId,
		mediaList,
		sourcesList,
		user: locals.user
	};
};

export const actions: Actions = {
	saveNotes: async ({ request, locals }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing ID' });

		const theological_notes = String(form.get('theological_notes') || '');
		const philosophical_notes = String(form.get('philosophical_notes') || '');
		const political_notes = String(form.get('political_notes') || '');

		// If human approved previously, any textual update resets status to 'draft' (Rule 4 in AGENTS.md)
		updateDeliberation(id, {
			theological_notes,
			philosophical_notes,
			political_notes,
			status: 'draft'
		});

		return { success: true };
	},

	addComment: async ({ request, locals }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const text = String(form.get('text') || '').trim();
		const author =
			locals.user?.username || locals.user?.id || String(form.get('author') || 'Użytkownik').trim();

		if (!id || !text) return fail(400, { error: 'Missing deliberation ID or text' });

		addCommentToDeliberation(id, { author, text });
		return { success: true };
	},

	createDeliberation: async ({ request, locals }) => {
		const form = await request.formData();
		const item_type = String(form.get('item_type') || 'media') as 'media' | 'source';
		const media_id = form.get('media_id') ? Number(form.get('media_id')) : null;
		const source_id = form.get('source_id') ? Number(form.get('source_id')) : null;
		const title = String(form.get('title') || '').trim();
		const key_quote = String(form.get('key_quote') || '').trim() || null;
		const created_by = locals.user?.username || locals.user?.id || 'admin';

		if (!title) return fail(400, { error: 'Tytuł jest wymagany' });

		const created = createDeliberation({
			item_type,
			media_id,
			source_id,
			title,
			key_quote,
			created_by
		});

		return { success: true, createdId: created.id };
	},

	approve: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Wymagane logowanie do zatwierdzenia kanonu' });
		}

		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing ID' });

		updateDeliberation(id, { status: 'human_approved' });
		return { success: true };
	}
};
