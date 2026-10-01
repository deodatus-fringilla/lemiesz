/**
 * Locale registry — the single source of truth for languages (plan §3.1).
 * A language is data + configuration, never schema. Adding one = a new entry here,
 * a new entry in project.inlang/settings.json, a messages/<code>.json file, and content.
 */
export const LOCALES = {
	pl: { label: 'Polski', fts: 'unicode61 remove_diacritics 2', minPrefix: 4, stemMode: 'keywords' },
	en: {
		label: 'English',
		fts: 'porter unicode61 remove_diacritics 2',
		minPrefix: 3,
		stemMode: 'porter'
	}
} as const;

export type Locale = keyof typeof LOCALES;
export const DEFAULT_LOCALE: Locale = 'pl';

// Languages we may STORE source text in, but do not offer as UI/output languages
// (e.g. Latin, German, French, Italian for encyclicals and Swiss/Hague documents).
export const ORIGINAL_ONLY = ['la', 'de', 'fr', 'it'] as const;
export type OriginalOnlyLocale = (typeof ORIGINAL_ONLY)[number];
export type AnySupportedLocale = Locale | OriginalOnlyLocale;

export const LOCALE_CODES = Object.keys(LOCALES) as Locale[];

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && Object.hasOwn(LOCALES, value);
}

/** Any language a source text row may be stored in (UI locales + original-only). */
export function isStorableLocale(value: unknown): value is AnySupportedLocale {
	return isLocale(value) || (ORIGINAL_ONLY as readonly string[]).includes(value as string);
}

/** FTS table name for a registered locale. Validated against the registry so it is safe to interpolate into SQL. */
export function ftsTable(locale: Locale): string {
	if (!isLocale(locale)) throw new Error(`Unknown locale "${locale}"`);
	return `fts_${locale}`;
}
