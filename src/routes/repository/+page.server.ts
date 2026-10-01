import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createSource,
	deleteSource,
	getTranslationCoverage,
	listSources,
	upsertSourceText
} from '$lib/server/sources';
import { CATEGORIES, validateIngestionChecklist, type IngestionChecklistItem } from '$lib/server/seed/checklist';
import {
	ORIGINS,
	REVIEW_STATES,
	ReviewTransitionError,
	human,
	setReview,
	type Origin,
	type Review
} from '$lib/server/review';
import { LOCALE_CODES, ORIGINAL_ONLY, isLocale, isStorableLocale } from '$lib/i18n/locales';

const str = (data: FormData, key: string) => String(data.get(key) ?? '').trim();

export const load: PageServerLoad = ({ url, locals }) => {
	const q = url.searchParams.get('q') || undefined;
	const category = url.searchParams.get('category') || undefined;
	const review = url.searchParams.get('review') || undefined;
	const localeParam = url.searchParams.get('locale');
	const locale = isLocale(localeParam) ? localeParam : isLocale(locals.locale) ? locals.locale : 'pl';

	const { sources, total } = listSources({ search: q, category, review, locale, limit: 200 });
	return {
		sources,
		total,
		coverage: getTranslationCoverage(),
		filters: { q: q ?? '', category: category ?? '', review: review ?? '', locale },
		options: {
			categories: [...CATEGORIES],
			origins: [...ORIGINS],
			reviews: [...REVIEW_STATES],
			uiLocales: [...LOCALE_CODES],
			originalLocales: [...LOCALE_CODES, ...ORIGINAL_ONLY]
		}
	};
};

export const actions: Actions = {
	/** New sources are always drafts; the curator is the signed-in user (never a form field). */
	create: async ({ request, locals }) => {
		const data = await request.formData();
		const actor = human(locals.user!.username);
		const item: Partial<IngestionChecklistItem> = {
			work: str(data, 'work'),
			section_ref: str(data, 'section_ref'),
			category: str(data, 'category') as IngestionChecklistItem['category'],
			url: str(data, 'url') || undefined,
			license: str(data, 'license'),
			original_locale: str(data, 'original_locale') as IngestionChecklistItem['original_locale'],
			cleared_to_store: data.get('cleared_to_store') === 'on',
			reviewer: actor.name,
			locale: str(data, 'locale') as IngestionChecklistItem['locale'],
			text: str(data, 'text'),
			origin: str(data, 'origin') as Origin,
			keywords: str(data, 'keywords') || undefined,
			translator: str(data, 'translator') || undefined
		};
		const validation = validateIngestionChecklist(item);
		if (!validation.valid) return fail(400, { action: 'create', errors: validation.errors });
		const id = createSource(item as IngestionChecklistItem, actor);
		return { action: 'create', createdId: id };
	},

	/** Adds or edits one language's text. Any change sends that text back to draft. */
	saveText: async ({ request, locals }) => {
		const data = await request.formData();
		const sourceId = Number(data.get('sourceId'));
		const locale = str(data, 'locale');
		const origin = str(data, 'origin');
		if (!Number.isInteger(sourceId) || !isStorableLocale(locale) || !str(data, 'text')) {
			return fail(400, { action: 'saveText', errors: ['Missing source, language or text'] });
		}
		try {
			upsertSourceText(
				sourceId,
				locale,
				{
					text: str(data, 'text'),
					keywords: str(data, 'keywords') || null,
					origin: (ORIGINS as readonly string[]).includes(origin) ? (origin as Origin) : undefined,
					translator: str(data, 'translator') || null,
					reason: 'edited in repository'
				},
				human(locals.user!.username)
			);
			return { action: 'saveText', updatedId: sourceId };
		} catch (err) {
			return fail(400, { action: 'saveText', errors: [(err as Error).message] });
		}
	},

	/** Human review decision: approve, flag or send back to draft. */
	review: async ({ request, locals }) => {
		const data = await request.formData();
		const sourceId = Number(data.get('sourceId'));
		const locale = str(data, 'locale');
		const to = str(data, 'to');
		if (!Number.isInteger(sourceId) || !isStorableLocale(locale) || !(REVIEW_STATES as readonly string[]).includes(to)) {
			return fail(400, { action: 'review', errors: ['Invalid review request'] });
		}
		try {
			setReview('source', sourceId, locale, to as Review, human(locals.user!.username), 'manual review');
			return { action: 'review', updatedId: sourceId };
		} catch (err) {
			const status = err instanceof ReviewTransitionError ? 403 : 500;
			return fail(status, { action: 'review', errors: [(err as Error).message] });
		}
	},

	delete: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { action: 'delete', errors: ['Admin only'] });
		const data = await request.formData();
		const sourceId = Number(data.get('sourceId'));
		if (!Number.isInteger(sourceId)) return fail(400, { action: 'delete', errors: ['Missing sourceId'] });
		deleteSource(sourceId);
		return { action: 'delete', deletedId: sourceId };
	}
};
