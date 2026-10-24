import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	createSource,
	deleteSource,
	getSource,
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
import { getCanon, listCanons } from '$lib/server/canon';
import {
	createLetter,
	deleteLetter,
	getLetter,
	listCorrespondenceThreads,
	listLetters,
	nextTurn,
	updateLetter,
	type LetterInput
} from '$lib/server/correspondence';

// "Spichlerz Lemiesza" (docs/00_Architect_Exchange/Propozycja_Spichlerz_UI.md): one reader for sources, canons and
// letters. All state is in the URL — ?view=sources|canon|letters &id=… &lang=… plus the list filters — so any
// document can be linked to directly.

const VIEWS = ['sources', 'canon', 'letters'] as const;
type View = (typeof VIEWS)[number];

const str = (data: FormData, key: string) => String(data.get(key) ?? '').trim();

export const load: PageServerLoad = ({ url, locals }) => {
	const p = url.searchParams;
	const view: View = (VIEWS as readonly string[]).includes(p.get('view') ?? '') ? (p.get('view') as View) : 'sources';
	const q = p.get('q') || undefined;
	const langParam = p.get('lang') ?? p.get('locale'); // `locale` kept for links made before the reader
	const lang = isLocale(langParam) ? langParam : isLocale(locals.locale) ? locals.locale : 'pl';
	const id = p.get('id') ?? '';
	const creating = p.get('new');

	const base = {
		view,
		filters: { q: q ?? '', category: p.get('category') ?? '', review: p.get('review') ?? '', thread: p.get('thread') ?? '', lang },
		selectedId: id,
		creating: creating === 'source' || creating === 'letter' ? creating : null,
		options: {
			categories: [...CATEGORIES],
			origins: [...ORIGINS],
			reviews: [...REVIEW_STATES],
			uiLocales: [...LOCALE_CODES],
			originalLocales: [...LOCALE_CODES, ...ORIGINAL_ONLY]
		},
		coverage: getTranslationCoverage(),
		categoryCounts: Object.fromEntries(
			(db.prepare('SELECT category, COUNT(*) AS n FROM sources GROUP BY category').all() as { category: string; n: number }[]).map((r) => [
				r.category,
				r.n
			])
		) as Record<string, number>,
		threads: listCorrespondenceThreads()
	};

	if (view === 'canon') {
		return { ...base, sources: [], letters: [], canons: listCanons(q), source: null, letter: null, canon: id ? getCanon(id) : null, nextTurn: 1 };
	}
	if (view === 'letters') {
		const threadId = Number(p.get('thread')) || undefined;
		const fallbackThread = threadId ?? base.threads[0]?.id;
		return {
			...base,
			sources: [],
			canons: [],
			letters: listLetters({ threadId, search: q }),
			letter: Number(id) ? getLetter(Number(id)) : null,
			source: null,
			canon: null,
			nextTurn: fallbackThread ? nextTurn(fallbackThread) : 1
		};
	}
	const { sources } = listSources({ search: q, category: p.get('category') || undefined, review: p.get('review') || undefined, locale: lang, limit: 200 });
	return {
		...base,
		sources,
		canons: [],
		letters: [],
		source: Number(id) ? getSource(Number(id), lang) : null,
		letter: null,
		canon: null,
		nextTurn: 1
	};
};

function letterFromForm(data: FormData): LetterInput {
	return {
		thread_id: Number(data.get('thread_id')),
		turn_number: Number(data.get('turn_number')),
		direction: str(data, 'direction') as LetterInput['direction'],
		sender: str(data, 'sender'),
		recipient: str(data, 'recipient'),
		date_label: str(data, 'date_label'),
		filename: str(data, 'filename'),
		summary_pl: str(data, 'summary_pl'),
		summary_en: str(data, 'summary_en'),
		body: String(data.get('body') ?? '')
	};
}

/** Where to go after a save: the same reader URL, pointed at the saved document. */
function readerUrl(request: Request, view: View, id: number | string): string {
	const back = new URL(request.headers.get('referer') ?? 'http://x/repository');
	const params = new URLSearchParams(back.searchParams);
	params.set('view', view);
	params.set('id', String(id));
	params.delete('new');
	return `/repository?${params}`;
}

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
		redirect(303, readerUrl(request, 'sources', id));
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
					// A form without the field keeps the recorded translation (never erase an attribution by omission).
					translator: data.has('translator') ? str(data, 'translator') || null : undefined,
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
	},

	createLetter: async ({ request }) => {
		const data = await request.formData();
		let id: number;
		try {
			id = createLetter(letterFromForm(data));
		} catch (err) {
			return fail(400, { action: 'createLetter', errors: (err as Error).message.split('; ') });
		}
		redirect(303, readerUrl(request, 'letters', id));
	},

	updateLetter: async ({ request }) => {
		const data = await request.formData();
		const id = Number(data.get('letterId'));
		try {
			updateLetter(id, letterFromForm(data));
			return { action: 'updateLetter', updatedId: id };
		} catch (err) {
			return fail(400, { action: 'updateLetter', errors: (err as Error).message.split('; ') });
		}
	},

	deleteLetter: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { action: 'deleteLetter', errors: ['Admin only'] });
		const data = await request.formData();
		const id = Number(data.get('letterId'));
		if (!Number.isInteger(id)) return fail(400, { action: 'deleteLetter', errors: ['Missing letterId'] });
		deleteLetter(id);
		return { action: 'deleteLetter', deletedId: id };
	}
};
