import { findUnverifiedQuotes } from '$lib/server/shield/cite';
import { SHORTS_WORDS, X_MAX_POST_CHARS, type Platform } from './formats';

export interface Check {
	/** Stable id; the UI maps it to a localized label. */
	id: 'x_post_length' | 'x_post_count' | 'shorts_length' | 'press_headline' | 'unresolved_tokens' | 'unverified_quotes' | 'unsupported_numbers';
	ok: boolean;
	/** Machine-readable detail (numbers, post indexes); the UI formats it. */
	detail?: string;
}

/** Posts of an X thread: separated by a line containing only "---". */
export function splitThread(body: string): string[] {
	return body
		.split(/^\s*---\s*$/m)
		.map((p) => p.trim())
		.filter(Boolean);
}

const codePoints = (s: string) => Array.from(s).length;

/** Spoken words of a script: bracketed editing cues do not count. */
export function spokenWords(body: string): number {
	return body.replace(/\[[^\]]*\]/g, ' ').split(/\s+/).filter(Boolean).length;
}

const NUMBER = /\d[\d.,]*\d|\d/g;
const significant = (n: string) => n.replace(/[.,]/g, '').length >= 2;

/**
 * Numbers (years, percentages, counts) in the draft that appear nowhere in the supplied material or the
 * brief. A model that invents a statistic is the commonest way an otherwise cited draft goes wrong.
 */
export function findUnsupportedNumbers(body: string, material: string[], brief: string): string[] {
	const known = new Set((material.join(' ') + ' ' + brief).match(NUMBER)?.filter(significant) ?? []);
	return [...new Set((body.match(NUMBER) ?? []).filter(significant))].filter((n) => !known.has(n));
}

/**
 * Deterministic checks on a draft. They never block copying (a human decides), but every failure is shown
 * next to the draft, because the commonest failure of an LLM draft is a quiet one.
 */
export function runChecks(args: {
	platform: Platform;
	body: string;
	sourceTexts: string[];
	/** Reference labels ("Work §ref") that the draft prints: their numbers (years, article numbers) are supported too. */
	referenceLabels?: string[];
	brief: string;
}): Check[] {
	const { platform, body, sourceTexts, brief } = args;
	const checks: Check[] = [];

	if (platform === 'x') {
		const posts = splitThread(body);
		const tooLong = posts.map((p, i) => ({ i: i + 1, n: codePoints(p) })).filter((p) => p.n > X_MAX_POST_CHARS);
		checks.push({ id: 'x_post_count', ok: posts.length >= 2 && posts.length <= 10, detail: String(posts.length) });
		checks.push({ id: 'x_post_length', ok: tooLong.length === 0, detail: tooLong.map((p) => `${p.i}:${p.n}`).join(',') });
	}
	if (platform === 'shorts') {
		const n = spokenWords(body);
		checks.push({ id: 'shorts_length', ok: n >= SHORTS_WORDS.min && n <= SHORTS_WORDS.max, detail: String(n) });
	}
	if (platform === 'press') {
		const headline = body.split('\n').find((l) => l.trim())?.trim() ?? '';
		checks.push({ id: 'press_headline', ok: headline.length > 0 && headline.length <= 120, detail: String(headline.length) });
	}

	checks.push({ id: 'unresolved_tokens', ok: !/\[\[/.test(body) });
	const unverified = findUnverifiedQuotes(body, sourceTexts);
	checks.push({ id: 'unverified_quotes', ok: unverified.length === 0, detail: String(unverified.length) });
	const numbers = findUnsupportedNumbers(body, [...sourceTexts, ...(args.referenceLabels ?? [])], brief);
	checks.push({ id: 'unsupported_numbers', ok: numbers.length === 0, detail: numbers.join(', ') });
	return checks;
}
