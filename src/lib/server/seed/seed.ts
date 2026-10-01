import { validateIngestionChecklist } from './checklist';
import { SEED_SOURCES } from './seedData';
import { createSource } from '$lib/server/sources';
import { db } from '$lib/server/db';
import { system } from '$lib/server/review';

/**
 * Seeds an EMPTY database with the starter corpus. Every row is created as `draft`;
 * nothing is pre-approved (plan §7.4). Set SEED_ON_EMPTY=false to skip.
 */
export function runSeed(): { seeded: number; skipped: number } {
	if (process.env.SEED_ON_EMPTY === 'false') return { seeded: 0, skipped: 0 };

	const { count } = db.prepare('SELECT COUNT(*) AS count FROM sources').get() as { count: number };
	if (count > 0) return { seeded: 0, skipped: count };

	let seeded = 0;
	let skipped = 0;
	for (const item of SEED_SOURCES) {
		const validation = validateIngestionChecklist(item);
		if (!validation.valid) {
			console.error(`[seed] Rejected "${item.work} ${item.section_ref}":`, validation.errors);
			skipped++;
			continue;
		}
		createSource(item, system('seed'));
		seeded++;
	}
	console.log(`[seed] Ingested ${seeded} draft sources (${skipped} rejected).`);
	return { seeded, skipped };
}
