import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db, LATEST_MIGRATION } from './db';
import { deconstructOpponentLetter, extractClaimsFromLetter, getCorrespondenceThread } from './correspondence';
import { getSeries } from './posters';
import { listMedia } from './media';
import { BASELINE_TABLES, snapshot } from '../../../scripts/db-snapshot.mjs';

// Invariants of the committed corpus, data/baseline.sql (corpus proposal v3.1 §3.3, group 3). This file runs in the
// `baseline` project: its database was created by $lib/server/db from the baseline, exactly as a new deployment is.
// Assert invariants, never row counts, so that adding a letter or a source through `pnpm db:snapshot` stays green.
// (That every stored text passes the ingestion checklist is ROBOT-07's job, in tests/robots.)

const BASELINE = fs.readFileSync('./data/baseline.sql', 'utf8');
const RUNTIME_TABLES = ['users', 'sessions', 'conversations', 'messages', 'content_drafts', 'card_usage', 'pipeline_runs', 'embeddings'];
const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

/** Spans that cite text found in no source. The allowlist is the to-do list: fix the card in the app, then remove it. */
const KNOWN_UNSOURCED_SPANS = [/^asymetryczny koszt inwazji/, /^asymmetric cost of invasion/];

describe('data/baseline.sql is current and complete', () => {
	it('was snapshotted at the newest migration', () => {
		expect(/^-- baseline-migration: (\S+)/m.exec(BASELINE)?.[1]).toBe(LATEST_MIGRATION);
	});

	it('loads into a fresh database, and snapshotting that database reproduces the file byte for byte', () => {
		const file = (db.pragma('database_list') as { file: string }[])[0].file;
		db.pragma('wal_checkpoint(TRUNCATE)');
		expect(snapshot(file)).toBe(BASELINE);
	});

	it('every table is classified: content (in the snapshot) or runtime (never in it)', () => {
		const tables = (
			db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'fts_%' AND name NOT LIKE 'sqlite_%'").all() as {
				name: string;
			}[]
		).map((t) => t.name);
		const unclassified = tables.filter((t) => t !== '_migrations' && !BASELINE_TABLES.includes(t) && !RUNTIME_TABLES.includes(t));
		expect(unclassified, 'add the new table to BASELINE_TABLES (scripts/db-snapshot.mjs) or to RUNTIME_TABLES here').toEqual([]);
	});

	it('runtime tables start empty: no user, session, conversation or draft ever ships in the baseline', () => {
		for (const t of RUNTIME_TABLES) expect(count(t), t).toBe(0);
		expect(BASELINE).not.toMatch(new RegExp(`^INSERT INTO (${RUNTIME_TABLES.join('|')}|_migrations|fts_\\w+) `, 'm'));
	});

	it('the full-text tables were built from the loaded texts', () => {
		const pl = (db.prepare("SELECT COUNT(*) AS n FROM source_texts WHERE locale = 'pl'").get() as { n: number }).n;
		const plArgs = (db.prepare("SELECT COUNT(*) AS n FROM argument_texts WHERE locale = 'pl'").get() as { n: number }).n;
		expect(count('fts_pl')).toBe(pl + plArgs);
		expect(count('fts_media')).toBe(count('media_assets'));
	});
});

describe('the corpus content', () => {
	it('contains real citations, not invented ones (regression: the v1 seed cited wrong paragraphs)', () => {
		const refs = (db.prepare("SELECT work || ' ' || section_ref AS r FROM sources").all() as { r: string }[]).map((x) => x.r).join('\n');
		expect(refs).toMatch(/Pacem in Terris.*§112/);
		expect(refs).toMatch(/Gaudium et Spes.*§78/);
		expect(refs).not.toMatch(/Gaudium et Spes.*§79\b(?! \(para)/);
	});

	it('flags AI placeholders instead of presenting them as movement text', () => {
		const placeholders = db
			.prepare("SELECT st.origin FROM sources s JOIN source_texts st ON st.source_id = s.id WHERE s.work LIKE '%PLACEHOLDER%'")
			.all() as { origin: string }[];
		expect(placeholders.length).toBeGreaterThan(0);
		for (const p of placeholders) expect(p.origin).toBe('ai_drafted');
	});

	it('marks the sources that seed/verify.eval.ts checks against their pages', () => {
		expect(count("sources WHERE verbatim_url_check = 1 AND url IS NOT NULL")).toBeGreaterThan(0);
	});

	it('every Bible quotation names its one translation per language (no hybrid of two Bibles)', () => {
		const bible = db
			.prepare("SELECT s.section_ref, st.locale, st.translator FROM sources s JOIN source_texts st ON st.source_id = s.id WHERE s.license LIKE '%Biblia Gdańska%'")
			.all() as { section_ref: string; locale: string; translator: string | null }[];
		expect(bible.length).toBeGreaterThan(0);
		for (const b of bible) expect(b.translator, `${b.section_ref} (${b.locale})`).toMatch(b.locale === 'pl' ? /^Biblia Gdańska/ : /^World English Bible/);
	});

	it('every argument span is a verbatim substring of the source it cites', () => {
		const texts = db.prepare('SELECT source_id, locale, text FROM source_texts').all() as { source_id: number; locale: string; text: string }[];
		const rows = db.prepare("SELECT argument_id, locale, supporting_spans_json FROM argument_texts WHERE supporting_spans_json IS NOT NULL").all() as {
			argument_id: number;
			locale: string;
			supporting_spans_json: string;
		}[];
		const bad: string[] = [];
		for (const r of rows) {
			for (const s of JSON.parse(r.supporting_spans_json) as { source_id: number; span: string }[]) {
				if (KNOWN_UNSOURCED_SPANS.some((k) => k.test(s.span))) continue;
				const own = texts.find((t) => t.source_id === s.source_id && t.locale === r.locale);
				if (!own?.text.includes(s.span)) bad.push(`argument ${r.argument_id}/${r.locale} -> source ${s.source_id}: "${s.span.slice(0, 50)}…"`);
			}
		}
		expect(bad).toEqual([]);
	});

	it('every poster image exists in static/', () => {
		for (const { image_path } of db.prepare('SELECT image_path FROM campaign_posters').all() as { image_path: string }[]) {
			expect(fs.existsSync(path.join('static', image_path)), image_path).toBe(true);
		}
	});

	it('the Doktryna Jeża series is complete: a planet, 8 satellites, 4 allegory/realism pairs with a moral quote', () => {
		const series = getSeries('doktryna-jeza', true);
		expect(series.planet?.image_path).toBe('/images/doktryna-jeza/hedgehog_planet_hero.jpg');
		expect(series.satellites.length).toBe(8);
		expect(series.pairs.length).toBe(4);
		for (const pair of series.pairs) {
			expect(pair.allegory).toBeDefined();
			expect(pair.realism).toBeDefined();
			expect(pair.moral_quote_pl).toBeTruthy();
		}
	});

	it('the starter media carry no lyrics, and the AI-assisted track names its tools', () => {
		const attemis = listMedia({ q: 'Attemis' })[0];
		expect(attemis).toMatchObject({ ai_assisted: true, lyrics_or_transcript: null });
		expect(attemis.production_credits).toMatch(/Suno/);
	});
});

describe('the Korona correspondence', () => {
	const { thread, letters } = getCorrespondenceThread('korona');

	it('every letter holds its full text, not a short fallback (regression: Docker images had no letter files)', () => {
		expect(thread).not.toBeNull();
		expect(letters.length).toBeGreaterThan(0);
		for (const l of letters) expect(l.body.length, l.filename).toBeGreaterThan(300);
	});

	it('turns run 1, 2, 3… without gaps, alternate direction, and open with our first letter', () => {
		expect(letters[0].filename).toBe('lemiesz_to_korona_01.txt');
		letters.forEach((l, i) => {
			expect(l.turn_number, l.filename).toBe(i + 1);
			expect(l.direction, l.filename).toBe(i % 2 === 0 ? 'outbound' : 'inbound');
		});
	});

	it('the archive copy of each letter in corpus/intake matches the database', () => {
		const dir = path.join('corpus', 'intake', 'letters_archive', 'Korona');
		for (const l of letters) {
			const file = path.join(dir, l.filename);
			if (fs.existsSync(file)) expect(fs.readFileSync(file, 'utf8').trim(), l.filename).toBe(l.body);
		}
	});

	it('extracts the polemical claims of korona_odp_04 and deconstructs them with retrieved cards', async () => {
		const odp4 = letters.find((l) => l.filename === 'korona_odp_04.txt')!;
		expect(extractClaimsFromLetter(odp4.body, 5).length).toBeGreaterThanOrEqual(3);
		const deconstructed = await deconstructOpponentLetter({ text: odp4.body, locale: 'pl', includeDrafts: true, maxClaims: 4 });
		expect(deconstructed.length).toBeGreaterThanOrEqual(3);
		expect(deconstructed.some((c) => c.arguments.length > 0 || c.sources.length > 0)).toBe(true);
	});
});
