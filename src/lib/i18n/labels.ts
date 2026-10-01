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
