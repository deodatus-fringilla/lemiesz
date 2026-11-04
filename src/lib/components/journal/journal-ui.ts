import { m } from '$lib/paraglide/messages.js';

/** Readable names of the media types offered for Biblioteka links. */
export function linkTypeLabel(type: string, lang?: 'pl' | 'en'): string {
	const labels: Record<string, (i: object, o: { locale?: 'pl' | 'en' }) => string> = {
		article: m.journal_type_article,
		podcast: m.journal_type_podcast,
		film: m.journal_type_film,
		video: m.journal_type_video,
		painting: m.journal_type_painting,
		music: m.journal_type_music,
		poetry: m.journal_type_poetry,
		speech: m.journal_type_speech
	};
	return labels[type]?.({}, lang ? { locale: lang } : {}) ?? type;
}
