import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = () => {
	const count = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
	return {
		sources: count('SELECT COUNT(*) AS c FROM sources'),
		arguments: count('SELECT COUNT(*) AS c FROM arguments'),
		toReview:
			count("SELECT COUNT(*) AS c FROM source_texts WHERE review = 'draft'") +
			count("SELECT COUNT(*) AS c FROM argument_texts WHERE review IN ('draft', 'ai_verified')"),
		flagged:
			count("SELECT COUNT(*) AS c FROM source_texts WHERE review = 'flagged'") +
			count("SELECT COUNT(*) AS c FROM argument_texts WHERE review = 'flagged'"),
		stale:
			count("SELECT COUNT(*) AS c FROM source_texts WHERE review = 'stale'") +
			count("SELECT COUNT(*) AS c FROM argument_texts WHERE review = 'stale'")
	};
};
