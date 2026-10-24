import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { validateIngestionChecklist, type Category, type IngestionChecklistItem } from '$lib/server/seed/checklist';
import type { Origin } from '$lib/server/review';
import type { AnySupportedLocale } from '$lib/i18n/locales';

// ROBOT-07 — The License & Cleared-to-Store Gate (docs/17_Robots/ROBOT-07-license-and-storage-gate.md).
// Wraps seed/checklist.ts. Runs in the baseline project: the database holds data/baseline.sql.
// Do not weaken an assertion to make it pass.

interface StoredText {
	work: string;
	section_ref: string;
	category: Category;
	url: string | null;
	license: string;
	cleared_to_store: number;
	original_locale: AnySupportedLocale;
	updated_by: string | null;
	text: string;
	locale: AnySupportedLocale;
	origin: Origin;
	keywords: string | null;
	translator: string | null;
}

/** Every stored text of the corpus, as the checklist item it would have been at ingestion. */
function storedItems(): IngestionChecklistItem[] {
	const rows = db
		.prepare(
			`SELECT s.work, s.section_ref, s.category, s.url, s.license, s.cleared_to_store, s.original_locale, s.updated_by,
			        st.text, st.locale, st.origin, st.keywords, st.translator
			 FROM sources s JOIN source_texts st ON st.source_id = s.id ORDER BY s.id, st.locale`
		)
		.all() as StoredText[];
	return rows.map((r) => ({
		work: r.work,
		section_ref: r.section_ref,
		category: r.category,
		url: r.url ?? undefined,
		license: r.license,
		cleared_to_store: r.cleared_to_store === 1,
		original_locale: r.original_locale,
		reviewer: r.updated_by ?? '',
		text: r.text,
		locale: r.locale,
		origin: r.origin,
		keywords: r.keywords ?? undefined,
		translator: r.translator ?? undefined
	}));
}

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

describe('ROBOT-07 · the committed corpus and the schema obey the same rules', () => {
	it('every stored text of data/baseline.sql passes the checklist', () => {
		const items = storedItems();
		expect(items.length, 'the baseline project must load data/baseline.sql').toBeGreaterThan(0);
		for (const item of items) {
			const r = validateIngestionChecklist(item);
			expect(r.valid, `${item.work} ${item.section_ref} (${item.locale}): ${r.errors.join('; ')}`).toBe(true);
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
		for (const p of callers) expect(fs.readFileSync(p, 'utf8'), p).toMatch(/validateIngestionChecklist/);
	});
});
