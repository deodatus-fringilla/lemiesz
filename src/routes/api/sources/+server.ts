import { json, type RequestHandler } from '@sveltejs/kit';
import { listSources, createSource, getTranslationCoverage } from '$lib/server/sources';
import { validateIngestionChecklist, type IngestionChecklistItem } from '$lib/server/seed/checklist';
import { human } from '$lib/server/review';
import { isLocale, DEFAULT_LOCALE } from '$lib/i18n/locales';

export const GET: RequestHandler = ({ url }) => {
	const localeParam = url.searchParams.get('locale');
	const result = listSources({
		search: url.searchParams.get('search') || undefined,
		category: url.searchParams.get('category') || undefined,
		review: url.searchParams.get('review') || undefined,
		clearedOnly: url.searchParams.get('clearedOnly') === 'true',
		locale: isLocale(localeParam) ? localeParam : DEFAULT_LOCALE,
		limit: Number(url.searchParams.get('limit')) || 50,
		offset: Number(url.searchParams.get('offset')) || 0
	});
	return json({ ...result, coverage: getTranslationCoverage() });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON body' }, { status: 400 });

	const actor = human(locals.user!.username);
	// Review state and actor are NOT read from the body: new sources are always drafts and the
	// curator is the signed-in user.
	const item: Partial<IngestionChecklistItem> = {
		work: body.work,
		section_ref: body.section_ref,
		category: body.category,
		url: body.url || undefined,
		license: body.license,
		original_locale: body.original_locale,
		cleared_to_store: body.cleared_to_store,
		reviewer: actor.name,
		locale: body.locale,
		text: body.text,
		origin: body.origin,
		keywords: body.keywords,
		translator: body.translator
	};

	const validation = validateIngestionChecklist(item);
	if (!validation.valid) {
		return json({ error: 'Ingestion validation failed', details: validation.errors }, { status: 400 });
	}

	const id = createSource(item as IngestionChecklistItem, actor);
	return json({ success: true, id }, { status: 201 });
};
