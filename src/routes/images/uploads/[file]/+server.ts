import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { CONTENT_TYPE, readUpload } from '$lib/server/image-files';

/**
 * Uploaded journal images. Readers get only approved ones; editors also see drafts. Cached for a day, not a year: an
 * image withdrawn later (e.g. a licence problem) must disappear from browsers and caches reasonably soon.
 */
export const GET: RequestHandler = ({ params, locals }) => {
	const bytes = readUpload(params.file);
	if (!bytes) error(404, 'Not found');
	const row = db.prepare('SELECT status FROM campaign_posters WHERE image_path = ?').get(`/images/uploads/${params.file}`) as { status: string } | undefined;
	const approved = row?.status === 'human_approved';
	if (!row || (!approved && !locals.user)) error(404, 'Not found');
	return new Response(new Uint8Array(bytes), {
		headers: {
			'Content-Type': CONTENT_TYPE[params.file.split('.').pop()!],
			'Content-Length': String(bytes.length),
			'Cache-Control': approved && !locals.user ? 'public, max-age=86400' : 'private, no-store'
		}
	});
};
