import { describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { createLetter } from '$lib/server/correspondence';
import { GET } from './+server';

const call = async (qs: string) => {
	const res = await GET({ url: new URL(`http://x/api/letters${qs}`) } as never);
	return { status: res.status, body: await res.json() };
};

describe('GET /api/letters', () => {
	it('rejects a missing or invalid thread id', async () => {
		expect((await call('')).status).toBe(400);
		expect((await call('?thread_id=abc')).status).toBe(400);
	});

	it('returns the full letters of one thread in turn order', async () => {
		const threadId = Number(
			db
				.prepare("INSERT INTO correspondence_threads (slug, title, interlocutor, organization) VALUES ('api-letters', 'API', 'X', 'Org')")
				.run().lastInsertRowid
		);
		const base = { thread_id: threadId, sender: 'A', recipient: 'B', date_label: 'X 2026', summary_pl: 's', summary_en: 's' };
		createLetter({ ...base, turn_number: 2, direction: 'inbound', filename: 'api_02.txt', body: 'odpowiedź' });
		createLetter({ ...base, turn_number: 1, direction: 'outbound', filename: 'api_01.txt', body: 'list' });
		const row = { thread_id: threadId };
		const { status, body } = await call(`?thread_id=${row.thread_id}`);
		expect(status).toBe(200);
		expect(body.letters.map((l: { body: string }) => l.body)).toEqual(['list', 'odpowiedź']);
		expect(body.letters.every((l: { thread_id: number; body: string }) => l.thread_id === row.thread_id && typeof l.body === 'string')).toBe(true);
		const turns = body.letters.map((l: { turn_number: number }) => l.turn_number);
		expect(turns).toEqual([...turns].sort((a: number, b: number) => a - b));
	});
});
