import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { validateIngestionChecklist, type IngestionChecklistItem } from '$lib/server/seed/checklist';
import { SEED_SOURCES } from '$lib/server/seed/seedData';

// ROBOT-07 — The License & Cleared-to-Store Gate (docs/17_Robots/ROBOT-07-license-and-storage-gate.md).
// Wraps seed/checklist.ts. Do not weaken an assertion to make it pass.

const valid: IngestionChecklistItem = {
	work: 'Hague Convention (V) (1907)',
	section_ref: 'Art. 1',
	category: 'geopolitics',
	url: 'https://avalon.law.yale.edu/20th_century/hague05.asp',
	license: 'Public domain (1907 treaty, official English text of the era)',
	original_locale: 'en',
	cleared_to_store: true,
	reviewer: 'alice',
	text: 'The territory of neutral Powers is inviolable.',
	locale: 'en',
	origin: 'original'
};
const errorsOf = (over: Partial<IngestionChecklistItem>) => validateIngestionChecklist({ ...valid, ...over }).errors.join(' | ');

describe('ROBOT-07 · nothing is stored without a documented licence and a named reviewer', () => {
	it('accepts a complete item (positive control)', () => {
		expect(validateIngestionChecklist(valid).valid).toBe(true);
	});

	it('SABOTAGE FIXTURES: missing licence, missing reviewer or missing decision are rejected', () => {
		expect(errorsOf({ license: '' })).toMatch(/License/);
		expect(errorsOf({ license: 'n/a' })).toMatch(/License/);
		expect(errorsOf({ reviewer: '  ' })).toMatch(/reviewer/i);
		expect(errorsOf({ cleared_to_store: undefined as unknown as boolean })).toMatch(/cleared_to_store/);
	});

	it('text that is not cleared for storage may only be a movement paraphrase or an AI draft of one', () => {
		expect(errorsOf({ cleared_to_store: false, origin: 'original' })).toMatch(/not cleared/);
		expect(validateIngestionChecklist({ ...valid, cleared_to_store: false, origin: 'paraphrase' }).valid).toBe(true);
	});

	it('a translation cannot be called public domain unless the licence says the release was verified', () => {
		expect(errorsOf({ origin: 'human_translation', license: 'Public domain' })).toMatch(/translation/i);
	});

	it('unregistered languages and non-http URLs are rejected', () => {
		expect(errorsOf({ locale: 'xx' as never })).toMatch(/locale/i);
		expect(errorsOf({ url: 'javascript:alert(1)' })).toMatch(/URL/);
	});
});

describe('ROBOT-07 · the seed and the schema obey the same rules', () => {
	it('every seed row passes the checklist', () => {
		for (const item of SEED_SOURCES) {
			const r = validateIngestionChecklist(item);
			expect(r.valid, `${item.work} ${item.section_ref}: ${r.errors.join('; ')}`).toBe(true);
		}
	});

	it('the schema defaults cleared_to_store to 0: clearance is never implicit', () => {
		const col = (db.prepare("PRAGMA table_info('sources')").all() as { name: string; dflt_value: string }[]).find(
			(c) => c.name === 'cleared_to_store'
		);
		expect(col?.dflt_value).toBe('0');
	});

	it('every production caller of createSource also imports the checklist (no unchecked back door)', () => {
		const callers: string[] = [];
		const walk = (dir: string) => {
			for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
				const p = path.join(dir, e.name);
				if (e.isDirectory()) walk(p);
				else if (/\.(ts|svelte)$/.test(e.name) && !/\.(test|eval)\.ts$/.test(e.name) && e.name !== 'testing.ts') {
					const src = fs.readFileSync(p, 'utf8');
					if (/\bcreateSource\s*\(/.test(src) && !/export function createSource/.test(src)) callers.push(p);
				}
			}
		};
		walk('src');
		expect(callers.length).toBeGreaterThan(0);
		for (const p of callers) expect(fs.readFileSync(p, 'utf8'), p).toMatch(/validateIngestionChecklist|runSeed/);
	});
});
