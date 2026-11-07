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
	draftText,
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
import { describeCitations, listCitableSources } from '$lib/server/journal-citations';
import { renderBlocks } from '$lib/server/journal-render';
import { assertUploadFields, imageIssues, listJournalImages, registerUpload, setImageMeta } from '$lib/server/journal-images';
import { ImageUploadError, inspectUpload, storeUpload } from '$lib/server/image-files';
import { setPosterStatus } from '$lib/server/posters';
import { listEditorMedia, mediaIssues } from '$lib/server/journal-media';
import { setMediaStatus } from '$lib/server/media';
import { BlockError, validateBlocks } from '$lib/journal-blocks';
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
		/** Images or media that keep the saved version from readers (shown before anyone presses approve). */
		contentProblems: text ? [...imageIssues(text.blocks, locale), ...mediaIssues(text.blocks)] : [],
		twins: twinCandidates(id, locale),
		sources: listCitableSources(),
		images: listJournalImages(),
		media: listEditorMedia(),
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
		let blocks: unknown;
		try {
			blocks = JSON.parse(String(d.get('blocks') ?? '[]'));
		} catch {
			return fail(400, { error: 'The article content could not be read; reload the page' });
		}
		return attempt(() => {
			saveText(id, locale, { title: str(d, 'title'), lead: str(d, 'lead'), blocks, columns: Number(d.get('columns')) }, human(locals.user!.username));
		});
	},
	/** Renders unsaved blocks exactly as readers would see them (same renderer as the public page). */
	preview: async ({ request }) => {
		const d = await request.formData();
		const locale = LOCALES.includes(str(d, 'locale')) ? str(d, 'locale') : 'pl';
		try {
			const blocks = validateBlocks(JSON.parse(String(d.get('blocks') ?? '[]')), { allowEmpty: true });
			return { preview: renderBlocks(blocks, locale) };
		} catch (e) {
			if (e instanceof BlockError || e instanceof SyntaxError) return fail(400, { error: e.message });
			throw e;
		}
	},
	/** An image compressed in the browser; checked, cleaned and stored here, then registered as a draft. */
	uploadImage: async ({ request, locals }) => {
		const d = await request.formData();
		const file = d.get('file');
		if (!(file instanceof File)) return fail(400, { error: 'No image was sent' });
		try {
			const fields = { title: str(d, 'title'), artist: str(d, 'artist'), license: str(d, 'license'), alt: str(d, 'alt'), locale: str(d, 'locale') || 'pl', caption: str(d, 'caption') };
			const actor = human(locals.user!.username);
			assertUploadFields(fields, actor); // refuse before anything is written
			const img = inspectUpload(Buffer.from(await file.arrayBuffer()));
			const path = storeUpload(img.bytes, img.type);
			const id = registerUpload({ ...fields, path, width: img.width, height: img.height }, actor);
			return { uploaded: id };
		} catch (e) {
			if (e instanceof ImageUploadError || e instanceof Error) return fail(400, { error: e.message });
			throw e;
		}
	},
	/** Alternative text / licence of a library image (public words: an approved image goes back to draft). */
	imageMeta: async ({ request, locals }) => {
		const d = await request.formData();
		const id = Number(d.get('imageId'));
		if (!Number.isInteger(id) || id <= 0) return fail(400, { error: 'Missing image' });
		const locale = str(d, 'locale') === 'en' ? 'en' : 'pl';
		try {
			// A licence is changed only when one is sent: adding a description must not erase the licence.
			setImageMeta(id, { [locale === 'en' ? 'alt_en' : 'alt_pl']: str(d, 'alt'), ...(str(d, 'license') ? { license: str(d, 'license') } : {}) }, human(locals.user!.username));
			return { success: true };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	},
	imageStatus: async ({ request, locals }) => {
		const d = await request.formData();
		const id = Number(d.get('imageId'));
		const to = str(d, 'to');
		if (!Number.isInteger(id) || id <= 0 || !['human_approved', 'flagged', 'draft'].includes(to)) return fail(400, { error: 'Bad request' });
		setPosterStatus(id, to as 'human_approved', human(locals.user!.username));
		return { success: true };
	},
	mediaStatus: async ({ request, locals }) => {
		const id = Number((await request.formData()).get('mediaId'));
		if (!Number.isInteger(id) || id <= 0) return fail(400, { error: 'Missing media' });
		setMediaStatus(id, 'human_approved', human(locals.user!.username));
		return { success: true };
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
	draft: async ({ params, request, locals }) => {
		const id = articleId(params);
		const locale = str(await request.formData(), 'locale') || 'pl';
		const result = attempt(() => draftText(id, locale, human(locals.user!.username)));
		if ('success' in result) redirect(303, `/redakcja/${id}?lang=${locale}`);
		return result;
	},
	delete: async ({ params }) => {
		const id = articleId(params);
		const result = attempt(() => void deleteArticle(id));
		if ('success' in result) redirect(303, '/redakcja');
		return result;
	}
};
