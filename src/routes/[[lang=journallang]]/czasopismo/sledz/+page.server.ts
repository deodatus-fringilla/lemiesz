import type { PageServerLoad } from './$types';
import { feedPath, langOf } from '$lib/journal-paths';

/** Public page that explains the RSS feed and gives its address to copy. */
export const load: PageServerLoad = ({ params, url }) => {
	const lang = langOf(params.lang);
	return { lang, origin: url.origin, feedUrl: `${url.origin}${feedPath(lang)}` };
};
