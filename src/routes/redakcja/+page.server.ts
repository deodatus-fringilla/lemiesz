import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { CALIBERS, LINK_TYPES, JournalError, createArticle, listForEditors, type Caliber } from '$lib/server/journal';
import { MediaError, createMedia, deleteMedia, listMedia, setMediaStatus, updateMedia, type MediaInput, type MediaStatus, type MediaType } from '$lib/server/media';
import { human } from '$lib/server/review';
import { checkLibraryLinks } from '$lib/server/link-check';

/** Journal back-office (behind login): articles in two calibres and the Biblioteka link library. */

const str = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const idOf = (d: FormData) => {
	const n = Number(d.get('mediaId'));
	return Number.isInteger(n) && n > 0 ? n : null;
};

function linkInput(d: FormData): MediaInput {
	return {
		title: str(d, 'title'),
		artist_or_author: str(d, 'artist_or_author'),
		media_type: str(d, 'media_type') as MediaType,
		url: str(d, 'url'),
		language: str(d, 'language'),
		public_note: str(d, 'public_note'),
		archive_url: str(d, 'archive_url'),
		notes: str(d, 'notes'),
		// A YouTube/Spotify address still becomes a playable embed; anything else is a plain link.
		as_link: true
	};
}

export const load: PageServerLoad = ({ url }) => ({
	tab: url.searchParams.get('tab') === 'biblioteka' ? ('biblioteka' as const) : ('rozprawy' as const),
	articles: listForEditors(),
	links: listMedia({ kind: 'all', limit: 500 }).filter((m) => m.platform === 'web' || m.public_note),
	linkTypes: LINK_TYPES,
	calibers: CALIBERS
});

export const actions: Actions = {
	createArticle: async ({ request, locals }) => {
		const d = await request.formData();
		let id: number;
		try {
			id = createArticle(
				{
					caliber: str(d, 'caliber') as Caliber,
					locale: str(d, 'locale') || 'pl',
					title: str(d, 'title'),
					lead: str(d, 'lead'),
					author: str(d, 'author') || null,
					tags: str(d, 'tags') || null
				},
				human(locals.user!.username)
			);
		} catch (e) {
			if (e instanceof JournalError) return fail(400, { error: e.message, form: 'article' });
			throw e;
		}
		redirect(303, `/redakcja/${id}`);
	},

	saveLink: async ({ request, locals }) => {
		const d = await request.formData();
		const id = idOf(d);
		// The editor's note is what makes a Biblioteka entry worth reading; it is required here.
		if (!str(d, 'public_note')) return fail(400, { error: 'The public note ("why this matters") is required', form: 'link' });
		try {
			if (id) updateMedia(id, linkInput(d), human(locals.user!.username));
			else createMedia(linkInput(d), human(locals.user!.username));
			return { success: true, form: 'link' };
		} catch (e) {
			if (e instanceof MediaError) return fail(400, { error: e.message, form: 'link' });
			throw e;
		}
	},

	setLinkStatus: async ({ request, locals }) => {
		const d = await request.formData();
		const id = idOf(d);
		if (!id) return fail(400, { error: 'Missing link id', form: 'link' });
		try {
			setMediaStatus(id, str(d, 'to') as MediaStatus, human(locals.user!.username));
			return { success: true };
		} catch (e) {
			if (e instanceof MediaError) return fail(400, { error: e.message, form: 'link' });
			throw e;
		}
	},

	/** Checks up to 50 web links (oldest check first) from this server; results are stored per link. */
	checkLinks: async () => {
		const { checked, broken } = await checkLibraryLinks({ limit: 50 });
		return { success: true, form: 'link', checked, broken };
	},

	deleteLink: async ({ request }) => {
		const id = idOf(await request.formData());
		if (!id) return fail(400, { error: 'Missing link id', form: 'link' });
		deleteMedia(id);
		return { success: true };
	}
};
