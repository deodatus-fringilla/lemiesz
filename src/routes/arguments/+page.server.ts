import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createArgument,
	deleteArgument,
	listArguments,
	setArgumentSources,
	upsertArgumentText
} from '$lib/server/arguments';
import { listSources } from '$lib/server/sources';
import { REVIEW_STATES, ReviewTransitionError, human, setReview, type Review } from '$lib/server/review';
import { LOCALE_CODES, isLocale, isStorableLocale } from '$lib/i18n/locales';
import { runDraftAndAudit } from '$lib/server/pipeline/pipeline';
import { getProvider } from '$lib/server/llm';

const str = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const ids = (d: FormData, k: string) =>
	d.getAll(k).map(Number).filter((n) => Number.isInteger(n) && n > 0);

export const load: PageServerLoad = ({ url, locals }) => {
	const q = url.searchParams.get('q') || undefined;
	const review = url.searchParams.get('review') || undefined;
	const localeParam = url.searchParams.get('locale');
	const locale = isLocale(localeParam) ? localeParam : isLocale(locals.locale) ? locals.locale : 'pl';

	const { arguments: cards, total } = listArguments({ search: q, review, locale, limit: 200 });
	const sources = listSources({ locale, limit: 500 }).sources.map((s) => ({
		id: s.id,
		label: `${s.work} ${s.section_ref}`
	}));
	return {
		cards,
		total,
		sources,
		filters: { q: q ?? '', review: review ?? '', locale },
		reviews: [...REVIEW_STATES],
		uiLocales: [...LOCALE_CODES],
		draftingConfigured: !!getProvider('drafter') && !!getProvider('auditor'),
		isAdmin: locals.user?.role === 'admin'
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const d = await request.formData();
		const locale = str(d, 'locale');
		if (!isStorableLocale(locale)) return fail(400, { action: 'create', errors: ['Unknown language'] });
		try {
			const id = createArgument(
				{
					locale,
					opponent_claim: str(d, 'opponent_claim'),
					counter_punch: str(d, 'counter_punch'),
					core_principle: str(d, 'core_principle'),
					fallacy_type: str(d, 'fallacy_type') || null,
					keywords: str(d, 'keywords') || null,
					source_ids: ids(d, 'source_ids'),
					origin: 'original'
				},
				human(locals.user!.username)
			);
			return { action: 'create', createdId: id };
		} catch (e) {
			return fail(400, { action: 'create', errors: [(e as Error).message] });
		}
	},

	saveText: async ({ request, locals }) => {
		const d = await request.formData();
		const argumentId = Number(d.get('argumentId'));
		const locale = str(d, 'locale');
		if (!Number.isInteger(argumentId) || !isStorableLocale(locale)) {
			return fail(400, { action: 'saveText', errors: ['Invalid request'] });
		}
		try {
			const actor = human(locals.user!.username);
			upsertArgumentText(
				argumentId,
				locale,
				{
					opponent_claim: str(d, 'opponent_claim'),
					counter_punch: str(d, 'counter_punch'),
					keywords: str(d, 'keywords') || null,
					reason: 'edited in arguments'
				},
				actor
			);
			if (d.has('source_ids_present')) setArgumentSources(argumentId, ids(d, 'source_ids'), actor);
			return { action: 'saveText', updatedId: argumentId };
		} catch (e) {
			return fail(400, { action: 'saveText', errors: [(e as Error).message] });
		}
	},

	review: async ({ request, locals }) => {
		const d = await request.formData();
		const argumentId = Number(d.get('argumentId'));
		const locale = str(d, 'locale');
		const to = str(d, 'to');
		if (!Number.isInteger(argumentId) || !isStorableLocale(locale) || !(REVIEW_STATES as readonly string[]).includes(to)) {
			return fail(400, { action: 'review', errors: ['Invalid request'] });
		}
		try {
			setReview('argument', argumentId, locale, to as Review, human(locals.user!.username), 'manual review');
			return { action: 'review', updatedId: argumentId };
		} catch (e) {
			return fail(e instanceof ReviewTransitionError ? 403 : 500, { action: 'review', errors: [(e as Error).message] });
		}
	},

	delete: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { action: 'delete', errors: ['Admin only'] });
		const d = await request.formData();
		deleteArgument(Number(d.get('argumentId')));
		return { action: 'delete' };
	},

	/** Drafter → span check → independent Auditor. Admin only: it spends LLM budget. */
	draft: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { action: 'draft', errors: ['Admin only'] });
		const d = await request.formData();
		const locale = str(d, 'locale');
		const sourceId = Number(d.get('sourceId'));
		if (!isLocale(locale) || !Number.isInteger(sourceId)) return fail(400, { action: 'draft', errors: ['Invalid request'] });
		try {
			const count = Math.min(Math.max(Number(d.get('count')) || 3, 1), 6);
			const s = await runDraftAndAudit({ sourceIds: [sourceId], locale, count, actor: locals.user!.username });
			return {
				action: 'draft',
				summary: { created: s.created, rejected: s.rejected, verified: s.verified, flagged: s.flagged, errors: s.errors }
			};
		} catch (e) {
			return fail(400, { action: 'draft', errors: [(e as Error).message] });
		}
	}
};
