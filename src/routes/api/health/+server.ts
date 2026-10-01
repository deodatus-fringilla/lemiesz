import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export const GET = () => {
	const ok = (db.prepare('SELECT 1 AS ok').get() as { ok: number }).ok === 1;
	return json({ ok }, { status: ok ? 200 : 503 });
};
