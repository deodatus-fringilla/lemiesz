import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	CALIBERS,
	JournalError,
	approveText,
	countedApprovalsOf,
	deleteArticle,
	flagText,
	unflagText,
	getArticle,
	getText,
	listApprovals,
	listLocales,
	publishText,
	requiredApprovals,
	saveText,
	setTwin,
	twinCandidates,
	unpublishText,
	updateArticleMeta,
	type Caliber
} from '$lib/server/journal';
import { describeCitations } from '$lib/server/journal-citations';
import { human } from '$lib/server/review';
import { db } from '$lib/server/db';

const LOCALES = ['pl', 'en'];
const str = (d: FormData, k: string) => String(d.get(k) ?? '').trim();

function articleId(params: { id: string }): number {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0 || !getArticle(id)) error(404, 'Article not found');
	return id;
}

export const load: PageServerLoad = ({ params, url, locals }) => {
	const id = articleId(params);
	const locales = listLocales(id);
	const asked = url.searchParams.get('lang');
	const locale = asked && LOCALES.includes(asked) ? asked : (locales[0] ?? 'pl');
	const article = getArticle(id)!;
	const text = getText(id, locale);
	return {
		article,
		locale,
		locales,
		allLocales: LOCALES,
		text,
		approvals: listApprovals(id, locale),
		counted: countedApprovalsOf(id, locale),
		required: requiredApprovals(article.caliber),
		citations: text ? describeCitations(text.body, locale) : [],
		twins: twinCandidates(id, locale),
		calibers: CALIBERS,
		me: locals.user!.username
	};
};

/** Runs one journal operation and turns its rule violations into a form error instead of a crash. */
function attempt(run: () => void) {
	try {
		run();
		return { success: true };
	} catch (e) {
		if (e instanceof JournalError) return fail(400, { error: e.message });
		throw e;
	}
}

export const actions: Actions = {
	saveText: async ({ params, request, locals }) => {
		const id = articleId(params);
		const d = await request.formData();
		const locale = LOCALES.includes(str(d, 'locale')) ? str(d, 'locale') : 'pl';
		return attempt(() => {
			saveText(id, locale, { title: str(d, 'title'), lead: str(d, 'lead'), body: String(d.get('body') ?? '') }, human(locals.user!.username));
		});
	},
	saveMeta: async ({ params, request, locals }) => {
		const id = articleId(params);
		const d = await request.formData();
		// One transaction: if the twin no longer fits (e.g. after a calibre change), nothing is half-saved.
		return attempt(() =>
			db.transaction(() => {
				const actor = human(locals.user!.username);
				updateArticleMeta(id, { caliber: str(d, 'caliber') as Caliber, author: str(d, 'author'), tags: str(d, 'tags') }, actor);
				const twin = Number(d.get('twin_id'));
				setTwin(id, Number.isInteger(twin) && twin > 0 ? twin : null, actor);
			})()
		);
	},
	approve: async ({ params, request, locals }) => {
		const id = articleId(params);
		const locale = str(await request.formData(), 'locale') || 'pl';
		return attempt(() => void approveText(id, locale, human(locals.user!.username)));
	},
	flag: async ({ params, request, locals }) => {
		const id = articleId(params);
		const locale = str(await request.formData(), 'locale') || 'pl';
		return attempt(() => flagText(id, locale, human(locals.user!.username)));
	},
	unflag: async ({ params, request, locals }) => {
		const id = articleId(params);
		const locale = str(await request.formData(), 'locale') || 'pl';
		return attempt(() => unflagText(id, locale, human(locals.user!.username)));
	},
	publish: async ({ params, request, locals }) => {
		const id = articleId(params);
		const locale = str(await request.formData(), 'locale') || 'pl';
		return attempt(() => publishText(id, locale, human(locals.user!.username)));
	},
	unpublish: async ({ params, request, locals }) => {
		const id = articleId(params);
		const locale = str(await request.formData(), 'locale') || 'pl';
		return attempt(() => unpublishText(id, locale, human(locals.user!.username)));
	},
	delete: async ({ params }) => {
		const id = articleId(params);
		const result = attempt(() => void deleteArticle(id));
		if ('success' in result) redirect(303, '/redakcja');
		return result;
	}
};
