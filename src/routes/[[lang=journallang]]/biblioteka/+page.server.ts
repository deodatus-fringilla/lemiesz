import type { PageServerLoad } from './$types';
import { listMedia } from '$lib/server/media';
import { LINK_TYPES } from '$lib/server/journal';
import { langOf } from '$lib/journal-paths';
import type { LibraryEntry } from '$lib/components/journal/public/types';

/** Public Biblioteka: human-approved items that carry an editor's note. Public fields only. */
export const load: PageServerLoad = ({ params, url }) => {
	const lang = langOf(params.lang);
	const typ = url.searchParams.get('typ');
	const all: LibraryEntry[] = listMedia({ kind: 'all', status: 'human_approved', limit: 1000 })
		.filter((m) => m.public_note)
		.map((m) => ({
			id: m.id,
			title: m.title,
			artist_or_author: m.artist_or_author,
			media_type: m.media_type,
			url: m.url,
			archive_url: m.archive_url,
			public_note: m.public_note!,
			language: m.language
		}));
	const types = LINK_TYPES.filter((t) => all.some((i) => i.media_type === t));
	const active = typ && (types as readonly string[]).includes(typ) ? typ : null;
	return { lang, items: active ? all.filter((i) => i.media_type === active) : all, types, active, origin: url.origin };
};
