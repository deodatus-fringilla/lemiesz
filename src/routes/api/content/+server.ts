import { json, type RequestHandler } from '@sveltejs/kit';
import { runContent, type ContentEvent } from '$lib/server/content/generate';
import { getProvider } from '$lib/server/llm';
import { getEmbedder } from '$lib/server/llm/embedder';

const sse = (e: ContentEvent) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;

/**
 * POST /api/content  { platform, tone?, brief, locale?, allowAiVerified? }  →  text/event-stream
 * Events: sources (first), token*, done | error. See ContentEvent.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body.brief !== 'string' || typeof body.platform !== 'string') {
		return json({ error: 'Body needs "platform" and "brief"' }, { status: 400 });
	}

	const events = runContent({
		author: locals.user!.username,
		platform: body.platform,
		tone: typeof body.tone === 'string' ? body.tone : undefined,
		brief: body.brief,
		outputLocale: typeof body.locale === 'string' ? body.locale : locals.locale,
		allowAiVerified: body.allowAiVerified === true,
		provider: getProvider('chat'),
		embedder: await getEmbedder().catch((e) => {
			console.error('[content] embedder unavailable, using lexical search only:', (e as Error).message);
			return null;
		})
	});

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				for await (const e of events) controller.enqueue(encoder.encode(sse(e)));
			} catch (err) {
				console.error('[content] unexpected error:', err);
				controller.enqueue(encoder.encode(sse({ type: 'error', code: 'llm_error', message: 'Unexpected server error.' })));
			} finally {
				controller.close();
			}
		},
		cancel() {
			void events.return(undefined);
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream; charset=utf-8',
			'cache-control': 'no-cache, no-transform',
			'x-accel-buffering': 'no'
		}
	});
};
