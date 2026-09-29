export const LOCALES = {
	pl: { label: 'Polski', fts: 'unicode61 remove_diacritics 2', minPrefix: 4, stemMode: 'keywords' },
	en: { label: 'English', fts: 'porter unicode61 remove_diacritics 2', minPrefix: 3, stemMode: 'porter' }
} as const;

export type Locale = keyof typeof LOCALES;
export const DEFAULT_LOCALE: Locale = 'pl';

// Languages we may STORE source text in, but do not offer as UI/output languages
// (e.g. Latin, German, French, Italian for encyclicals and Swiss documents).
export const ORIGINAL_ONLY = ['la', 'de', 'fr', 'it'] as const;
export type OriginalOnlyLocale = (typeof ORIGINAL_ONLY)[number];
export type AnySupportedLocale = Locale | OriginalOnlyLocale;
