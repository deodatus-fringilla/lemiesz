import { DEFAULT_LOCALE } from '$lib/i18n/locales';

/**
 * Platform templates and tone presets (plan §6.1). They are data keyed by locale, not code: Polish press
 * style differs from English press style, and a new language adds entries here instead of changing logic.
 * Formatting only: nothing here publishes anywhere (no social-API integrations in v1).
 */
export const PLATFORMS = ['x', 'facebook', 'shorts', 'press'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const TONES = ['assertive', 'pastoral', 'formal', 'conversational'] as const;
export type Tone = (typeof TONES)[number];

export const X_MAX_POST_CHARS = 280;
export const SHORTS_WORDS = { min: 75, max: 150 }; // roughly 30-60 s of speech
export const MAX_QUOTABLE_CHARS = 300; // only short sources may be quoted inline

export const DEFAULT_TONE: Record<Platform, Tone> = {
	x: 'assertive',
	facebook: 'pastoral',
	shorts: 'conversational',
	press: 'formal'
};

type PerLocale = Record<string, string>;
const pick = (m: PerLocale, locale: string) => m[locale] ?? m[DEFAULT_LOCALE] ?? m.en;

const PLATFORM_RULES: Record<Platform, PerLocale> = {
	x: {
		pl: `Napisz wątek na X (Twitter) złożony z 3-7 wpisów. Pierwszy wpis to mocny haczyk. Oddziel wpisy linią zawierającą wyłącznie "---". Każdy wpis ma mieć NAJWYŻEJ ${X_MAX_POST_CHARS} znaków, wliczając odwołania i cytaty. Nie numeruj wpisów i nie dodawaj hashtagów, chyba że poproszono.`,
		en: `Write a thread for X (Twitter) of 3-7 posts. The first post is a strong hook. Separate posts with a line containing only "---". Each post must be AT MOST ${X_MAX_POST_CHARS} characters, including references and quotations. Do not number the posts and do not add hashtags unless asked.`
	},
	facebook: {
		pl: 'Napisz post na Facebooka: 120-250 słów, akapity oddzielone pustą linią, ciepły i rozmowny ton, bez nadmiaru emotikon, na końcu jedno zdanie zachęcające do refleksji lub rozmowy.',
		en: 'Write a Facebook post: 120-250 words, paragraphs separated by a blank line, warm and conversational, no emoji spam, ending with one sentence that invites reflection or conversation.'
	},
	shorts: {
		pl: `Napisz scenariusz krótkiego wideo (Shorts/TikTok) na 30-60 sekund mówionego tekstu, czyli ${SHORTS_WORDS.min}-${SHORTS_WORDS.max} słów do wypowiedzenia. Zacznij od haczyka. Wskazówki dla montażu wpisuj w nawiasach kwadratowych, np. [Pauza] albo [Pokaż grafikę: cytat]. Nie wliczaj wskazówek do liczby słów.`,
		en: `Write a short-video (Shorts/TikTok) script for 30-60 seconds of speech, meaning ${SHORTS_WORDS.min}-${SHORTS_WORDS.max} spoken words. Open with a hook. Put editing cues in square brackets, e.g. [Pause] or [Show graphic: quote]. Cues do not count towards the word total.`
	},
	press: {
		pl: 'Napisz komunikat prasowy: pierwsza linia to nagłówek (do 120 znaków), druga to dateline w formie "[DATA] — [MIEJSCOWOŚĆ]", dalej 2-4 zwięzłe akapity w formalnym, rzeczowym stylu, na końcu linia "[KONTAKT DLA MEDIÓW]". Nie wymyślaj nazwisk, stanowisk, dat ani danych kontaktowych: zostaw nawiasy kwadratowe do uzupełnienia.',
		en: 'Write a press statement: the first line is the headline (at most 120 characters), the second a dateline like "[DATE] — [CITY]", then 2-4 concise paragraphs in a formal, factual register, ending with a line "[MEDIA CONTACT]". Do not invent names, titles, dates or contact details: leave square-bracket placeholders to be filled in.'
	}
};

const TONE_RULES: Record<Tone, PerLocale> = {
	assertive: {
		pl: 'Ton: stanowczy i konkretny; nazwij słabość zarzutu i przejdź do stanowiska ruchu.',
		en: 'Tone: assertive and concrete; name the weakness in the attack and pivot to the movement’s position.'
	},
	pastoral: {
		pl: 'Ton: duszpasterski, spokojny, odwołujący się do wspólnego dobra; bez agresji i szyderstwa.',
		en: 'Tone: pastoral, calm, appealing to the common good; no aggression or mockery.'
	},
	formal: {
		pl: 'Ton: oficjalny, rzeczowy, w trzeciej osobie; bez języka potocznego.',
		en: 'Tone: official and factual, third person; no colloquial language.'
	},
	conversational: {
		pl: 'Ton: potoczny i bezpośredni, krótkie zdania, zwrot do odbiorcy.',
		en: 'Tone: conversational and direct, short sentences, addressing the viewer.'
	}
};

export function platformInstructions(platform: Platform, tone: Tone, locale: string): string {
	return `${pick(PLATFORM_RULES[platform], locale)}\n${pick(TONE_RULES[tone], locale)}`;
}

export const isPlatform = (v: unknown): v is Platform => (PLATFORMS as readonly string[]).includes(v as string);
export const isTone = (v: unknown): v is Tone => (TONES as readonly string[]).includes(v as string);

/** Typographic quotation marks per language for verbatim quotations. */
export function quoteMarks(locale: string): [string, string] {
	return locale === 'pl' ? ['„', '”'] : ['“', '”'];
}
