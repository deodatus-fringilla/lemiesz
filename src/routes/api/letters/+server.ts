import { json, type RequestHandler } from '@sveltejs/kit';
import { listLetters } from '$lib/server/correspondence';
import type { ReaderLetter } from '$lib/components/letters/letter-reader';

/** Full letters of one correspondence thread, for the letter reader (loaded only when it opens). */
export const GET: RequestHandler = ({ url }) => {
	const threadId = Number(url.searchParams.get('thread_id'));
	if (!Number.isInteger(threadId) || threadId <= 0) return json({ error: 'thread_id is required' }, { status: 400 });
	const letters: ReaderLetter[] = listLetters({ threadId }).map((l) => ({
		id: l.id,
		thread_id: l.thread_id,
		turn_number: l.turn_number,
		direction: l.direction,
		sender: l.sender,
		recipient: l.recipient,
		date_label: l.date_label,
		filename: l.filename,
		body: l.body
	}));
	return json({ letters });
};
