/** Public journal URLs, shared by server and client. Polish is the unprefixed default; English lives under /en. */
export type JournalLang = 'pl' | 'en';

export const langOf = (param: string | undefined): JournalLang => (param === 'en' ? 'en' : 'pl');
const prefix = (lang: JournalLang) => (lang === 'en' ? '/en' : '');

export const journalHome = (lang: JournalLang) => `${prefix(lang)}/czasopismo`;
export const articlePath = (lang: JournalLang, slug: string) => `${prefix(lang)}/czasopismo/${slug}`;
export const libraryPath = (lang: JournalLang) => `${prefix(lang)}/biblioteka`;
export const feedPath = (lang: JournalLang) => `${prefix(lang)}/czasopismo/rss.xml`;

/** Paths readers may open without signing in (read-only: the hook allows GET and HEAD only). */
export const PUBLIC_JOURNAL_PATH = /^\/(?:en\/)?(?:czasopismo|biblioteka)(?:\/|$)|^\/sitemap\.xml$|^\/images\/uploads\/[^/]+$/;
