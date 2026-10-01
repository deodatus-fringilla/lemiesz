import { m } from '$lib/paraglide/messages.js';

type MessageKey = keyof typeof m;
const call = (key: string): string => {
	const fn = (m as Record<string, unknown>)[key];
	return typeof fn === 'function' ? (fn as () => string)() : key;
};

export const reviewLabel = (state: string) => call(`review_${state}`);
export const originLabel = (origin: string) => call(`origin_${origin}`);
export const categoryLabel = (category: string) => call(`cat_${category}`);
export const languageLabel = (code: string) => call(`lang_${code}`);

export type { MessageKey };

export const platformLabel = (p: string) => call(`content_platform_${p}`);
export const toneLabel = (t: string) => call(`content_tone_${t}`);
export const checkLabel = (id: string) => call(`content_check_${id}`);

export const genreLabel = (g: string) => call(`genre_${g}`);
export const mediaTypeLabel = (t: string) => call(`media_type_${t}`);
export const mediaStatusLabel = (s: string) => call(`media_status_${s}`);
