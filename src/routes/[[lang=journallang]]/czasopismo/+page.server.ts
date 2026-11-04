import type { PageServerLoad } from './$types';
import { listPublished, summarise, type Caliber } from '$lib/server/journal';
import { langOf } from '$lib/journal-paths';

/** Public front page: the latest of each calibre, or search / tag / calibre results. Published versions only. */
export const load: PageServerLoad = ({ params, url }) => {
	const lang = langOf(params.lang);
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const tag = (url.searchParams.get('tag') ?? '').trim().slice(0, 60);
	const k = url.searchParams.get('kaliber');
	const caliber: Caliber | undefined = k === 'light' || k === 'heavy' ? k : undefined;
	const filtered = Boolean(q || tag || caliber);
	return {
		lang,
		q,
		tag,
		caliber: caliber ?? null,
		filtered,
		light: filtered ? [] : listPublished({ locale: lang, caliber: 'light', limit: 12 }).map(summarise),
		heavy: filtered ? [] : listPublished({ locale: lang, caliber: 'heavy', limit: 12 }).map(summarise),
		results: filtered ? listPublished({ locale: lang, caliber, tag, q, limit: 50 }).map(summarise) : [],
		hasEnglish: lang === 'pl' && listPublished({ locale: 'en', limit: 1 }).length > 0,
		origin: url.origin
	};
};
