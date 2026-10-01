import { isStorableLocale, type AnySupportedLocale } from '$lib/i18n/locales';
import { ORIGINS, type Origin } from '$lib/server/review';

export const CATEGORIES = ['magisterium', 'geopolitics', 'economics', 'movement'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface IngestionChecklistItem {
	work: string;
	section_ref: string;
	category: Category;
	url?: string;
	/** Exact licence / reproduction terms. Never "public domain" unless it really is. */
	license: string;
	original_locale: AnySupportedLocale;
	/** Explicit human decision (plan §9). No default. */
	cleared_to_store: boolean;
	/** Curator who checked licence and provenance. */
	reviewer: string;
	text: string;
	locale: AnySupportedLocale;
	origin: Origin;
	keywords?: string;
	translator?: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

/**
 * Plan §9 ingestion checklist. Runs before any source enters the repository.
 * Never trusts client-supplied review state: that is decided server-side (see review.ts).
 */
export function validateIngestionChecklist(item: Partial<IngestionChecklistItem>): ValidationResult {
	const errors: string[] = [];
	const blank = (v: unknown) => typeof v !== 'string' || v.trim().length === 0;

	if (blank(item.work)) errors.push('Work title is required');
	if (blank(item.section_ref)) errors.push('Section reference (§ / article / chapter) is required');
	if (!item.category || !(CATEGORIES as readonly string[]).includes(item.category)) {
		errors.push(`Category must be one of: ${CATEGORIES.join(', ')}`);
	}
	if (blank(item.text)) errors.push('Text is required');
	if (blank(item.reviewer)) errors.push('Curator / reviewer name is required');

	if (!item.origin || !(ORIGINS as readonly string[]).includes(item.origin)) {
		errors.push(`Origin must be one of: ${ORIGINS.join(', ')}`);
	}
	if (!isStorableLocale(item.original_locale)) {
		errors.push(`Original locale "${item.original_locale}" is not in the locale registry`);
	}
	if (!isStorableLocale(item.locale)) {
		errors.push(`Text locale "${item.locale}" is not in the locale registry`);
	}

	if (item.url !== undefined && item.url !== '') {
		try {
			const u = new URL(item.url);
			if (u.protocol !== 'http:' && u.protocol !== 'https:') errors.push('URL must be http(s)');
		} catch {
			errors.push('URL is not valid');
		}
	}

	if (blank(item.license) || (item.license as string).trim().length < 5) {
		errors.push('License / reproduction terms must be documented explicitly');
	} else if (
		/public domain/i.test(item.license as string) &&
		item.origin &&
		/translation/.test(item.origin) &&
		!/verified/i.test(item.license as string)
	) {
		errors.push(
			'A translation cannot be labelled "public domain" unless the licence text says the release was verified'
		);
	}

	if (typeof item.cleared_to_store !== 'boolean') {
		errors.push('cleared_to_store must be an explicit yes/no decision');
	} else if (!item.cleared_to_store && item.origin && !['paraphrase', 'ai_drafted'].includes(item.origin)) {
		errors.push(
			'Sources not cleared for storage may hold only a movement paraphrase (origin "paraphrase") or an AI draft of one'
		);
	}

	return { valid: errors.length === 0, errors };
}
