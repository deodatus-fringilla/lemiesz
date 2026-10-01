import { json, type RequestHandler } from '@sveltejs/kit';
import { getProvider } from '$lib/server/llm';
import { getEmbedder } from '$lib/server/llm/embedder';
import { runShield, type ShieldEvent } from '$lib/server/shield/shield';

const sse = (e: ShieldEvent) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;

/**
 * POST /api/chat  { message, conversationId?, includeDrafts? }  →  text/event-stream
 * Events: sources (first), token*, done | error. See ShieldEvent.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body.message !== 'string') return json({ error: 'Body needs "message"' }, { status: 400 });

	const events = runShield({
		userId: locals.user!.id,
		message: body.message,
		conversationId: typeof body.conversationId === 'string' ? body.conversationId : null,
		outputLocale: typeof body.locale === 'string' ? body.locale : locals.locale,
		includeDrafts: body.includeDrafts === true,
		provider: getProvider('chat'),
		embedder: await getEmbedder().catch((e) => {
			console.error('[shield] embedder unavailable, using lexical search only:', (e as Error).message);
			return null;
		})
	});

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				for await (const e of events) controller.enqueue(encoder.encode(sse(e)));
			} catch (err) {
				console.error('[shield] unexpected error:', err);
				controller.enqueue(
					encoder.encode(sse({ type: 'error', code: 'llm_error', message: 'Unexpected server error.' }))
				);
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
