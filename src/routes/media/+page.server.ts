import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	GENRES,
	MEDIA_TYPES,
	MediaError,
	createMedia,
	deleteMedia,
	getMedia,
	linkMedia,
	linksForMedia,
	listMedia,
	setMediaStatus,
	unlinkMedia,
	updateMedia,
	type Genre,
	type MediaInput,
	type MediaStatus,
	type MediaType
} from '$lib/server/media';
import { listArguments } from '$lib/server/arguments';
import { human } from '$lib/server/review';

const str = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const idOf = (d: FormData, k = 'mediaId') => {
	const n = Number(d.get(k));
	return Number.isInteger(n) && n > 0 ? n : null;
};

function inputFrom(d: FormData): MediaInput {
	return {
		title: str(d, 'title'),
		artist_or_author: str(d, 'artist_or_author'),
		media_type: str(d, 'media_type') as MediaType,
		genre: (str(d, 'genre') || 'other') as Genre,
		mood: str(d, 'mood'),
		target_audience: str(d, 'target_audience'),
		url: str(d, 'url'),
		language: str(d, 'language'),
		ai_assisted: d.get('ai_assisted') === 'on',
		production_credits: str(d, 'production_credits'),
		lyrics_or_transcript: String(d.get('lyrics_or_transcript') ?? ''),
		lyrics_cleared_to_store: d.get('lyrics_cleared_to_store') === 'on',
		lyrics_license: str(d, 'lyrics_license'),
		notes: str(d, 'notes')
	};
}

export const load: PageServerLoad = ({ url, locals }) => {
	const genreParam = url.searchParams.get('genre');
	const genre = (GENRES as readonly string[]).includes(genreParam ?? '') ? (genreParam as Genre) : undefined;
	const q = url.searchParams.get('q')?.trim() || undefined;
	const selectedId = Number(url.searchParams.get('m'));
	const selected = Number.isInteger(selectedId) && selectedId > 0 ? getMedia(selectedId) : null;
	const locale = locals.locale === 'en' ? 'en' : 'pl';

	return {
		items: listMedia({ genre, q }),
		selected,
		links: selected ? linksForMedia(selected.id) : [],
		arguments: listArguments({ locale, limit: 200 }).arguments.map((a) => ({ id: a.id, label: a.texts?.[locale]?.opponent_claim ?? a.texts?.en?.opponent_claim ?? `#${a.id}` })),
		filters: { genre: genre ?? '', q: q ?? '' },
		genres: [...GENRES],
		types: [...MEDIA_TYPES],
		isAdmin: locals.user?.role === 'admin',
		username: locals.user?.username ?? ''
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const d = await request.formData();
		try {
			const id = createMedia(inputFrom(d), human(locals.user!.username));
			return { action: 'create', mediaId: id };
		} catch (e) {
			return fail(400, { action: 'create', errors: [(e as Error).message] });
		}
	},

	update: async ({ request, locals }) => {
		const d = await request.formData();
		const id = idOf(d);
		if (!id) return fail(400, { action: 'update', errors: ['Missing item'] });
		try {
			updateMedia(id, inputFrom(d), human(locals.user!.username));
			return { action: 'update', mediaId: id };
		} catch (e) {
			return fail(400, { action: 'update', errors: [(e as Error).message] });
		}
	},

	/** The actor is the signed-in user; the target state is checked against the known list inside setMediaStatus. */
	status: async ({ request, locals }) => {
		const d = await request.formData();
		const id = idOf(d);
		if (!id) return fail(400, { action: 'status', errors: ['Missing item'] });
		try {
			setMediaStatus(id, str(d, 'to') as MediaStatus, human(locals.user!.username));
			return { action: 'status', mediaId: id };
		} catch (e) {
			return fail(e instanceof MediaError ? 403 : 500, { action: 'status', errors: [(e as Error).message] });
		}
	},

	delete: async ({ request, locals }) => {
		const id = idOf(await request.formData());
		if (!id) return fail(400, { action: 'delete', errors: ['Missing item'] });
		const item = getMedia(id);
		if (item && locals.user?.role !== 'admin' && item.created_by !== locals.user?.username) {
			return fail(403, { action: 'delete', errors: ['forbidden'] });
		}
		deleteMedia(id);
		return { action: 'delete' };
	},

	link: async ({ request, locals }) => {
		const d = await request.formData();
		const mediaId = idOf(d);
		const argumentId = idOf(d, 'argumentId');
		if (!mediaId || !argumentId) return fail(400, { action: 'link', errors: ['Missing item or argument'] });
		try {
			linkMedia(argumentId, mediaId, str(d, 'cue') || null, null, human(locals.user!.username));
			return { action: 'link', mediaId };
		} catch (e) {
			return fail(400, { action: 'link', errors: [(e as Error).message] });
		}
	},

	unlink: async ({ request }) => {
		const d = await request.formData();
		const mediaId = idOf(d);
		const argumentId = idOf(d, 'argumentId');
		if (mediaId && argumentId) unlinkMedia(argumentId, mediaId);
		return { action: 'unlink', mediaId };
	}
};
