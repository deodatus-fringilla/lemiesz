import { json, type RequestHandler } from '@sveltejs/kit';
import { getSource, upsertSourceText, deleteSource } from '$lib/server/sources';
import { human, ORIGINS, type Origin } from '$lib/server/review';
import { DEFAULT_LOCALE, isLocale, isStorableLocale } from '$lib/i18n/locales';

function parseId(raw: string | undefined): number | null {
	const id = Number(raw);
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const GET: RequestHandler = ({ params, url }) => {
	const id = parseId(params.id);
	if (!id) return json({ error: 'Invalid ID' }, { status: 400 });
	const localeParam = url.searchParams.get('locale');
	const source = getSource(id, isLocale(localeParam) ? localeParam : DEFAULT_LOCALE);
	return source ? json(source) : json({ error: 'Source not found' }, { status: 404 });
};

/** Edits one language's text. Any change resets that row to `draft`; approval is a separate call. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const id = parseId(params.id);
	if (!id) return json({ error: 'Invalid ID' }, { status: 400 });

	const body = await request.json().catch(() => null);
	if (!body || typeof body.text !== 'string' || !isStorableLocale(body.locale)) {
		return json({ error: 'Body needs "locale" and "text"' }, { status: 400 });
	}
	if (body.origin !== undefined && !(ORIGINS as readonly string[]).includes(body.origin)) {
		return json({ error: 'Invalid origin' }, { status: 400 });
	}

	try {
		const result = upsertSourceText(
			id,
			body.locale,
			{
				text: body.text,
				keywords: body.keywords,
				origin: body.origin as Origin | undefined,
				translator: body.translator,
				reason: body.reason
			},
			human(locals.user!.username)
		);
		return json({ success: true, ...result, source: getSource(id, body.locale) });
	} catch (err) {
		return json({ error: (err as Error).message }, { status: 400 });
	}
};

export const DELETE: RequestHandler = ({ params, locals }) => {
	if (locals.user?.role !== 'admin') return json({ error: 'Admin only' }, { status: 403 });
	const id = parseId(params.id);
	if (!id) return json({ error: 'Invalid ID' }, { status: 400 });
	return deleteSource(id) ? json({ success: true }) : json({ error: 'Source not found' }, { status: 404 });
};
