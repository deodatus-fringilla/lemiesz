import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../db';
import { HashEmbedder } from '../llm/embedders/hash';
import { upsertSourceText } from '../sources';
import { human } from '../review';
import { makeArgument, makeSource } from '../testing';
import { reciprocalRankFusion } from './fuse';
import { allowedReviews, isAllowed, needsWatermark } from './trust';
import { detectLocale, recordUsage, retrieve } from './retrieve';
import { indexMissing, reindexAll, searchVectors } from './vectors';

const embedder = new HashEmbedder();
let piT: number, hague: number, secretDraft: number, plSource: number;
let humanArg: number, aiArg: number, flaggedArg: number, draftArg: number;

beforeAll(() => {
	piT = makeSource({
		work: 'Pacem in Terris',
		section_ref: '§127',
		text: 'In this age which boasts of its atomic power, it no longer makes sense to maintain that war is a fit instrument with which to repair the violation of justice.'
	});
	hague = makeSource({
		work: 'Hague Convention V',
		section_ref: 'Art. 1',
		text: 'The territory of neutral Powers is inviolable.'
	});
	secretDraft = makeSource(
		{ work: 'Draft memo', section_ref: '§9', text: 'Grain exports and tariffs must be reviewed by the committee.' },
		'draft'
	);
	plSource = makeSource({
		work: 'Manifest',
		section_ref: 'I',
		locale: 'pl',
		original_locale: 'pl',
		text: 'Neutralność wymaga nienaruszalności terytorium państwa i suwerennych decyzji obronnych.'
	});

	humanArg = makeArgument(
		{
			source_ids: [hague],
			opponent_claim: 'Neutral countries are isolationists who refuse to help their allies',
			counter_punch: 'Neutrality is not isolation: inviolable territory is settled international law.'
		},
		'human_approved'
	);
	aiArg = makeArgument(
		{
			source_ids: [hague],
			opponent_claim: 'Neutrality is naive appeasement of aggressors',
			counter_punch: 'Appeasement gives concessions; neutrality gives none and keeps territory inviolable.'
		},
		'ai_verified'
	);
	flaggedArg = makeArgument(
		{
			source_ids: [piT],
			opponent_claim: 'Peace requires unilateral disarmament by everyone immediately',
			counter_punch: 'A flagged, unreliable reply about disarmament.'
		},
		'flagged'
	);
	draftArg = makeArgument(
		{
			source_ids: [piT],
			opponent_claim: 'Pacifists ignore reality about sanctions embargo policy',
			counter_punch: 'A draft reply about sanctions embargo.'
		},
		'draft'
	);
});

describe('trust tiers (plan §7.4)', () => {
	it('matches the ratified table', () => {
		expect(allowedReviews('shield')).toEqual(['human_approved', 'ai_verified']);
		expect(allowedReviews('shield', { includeDrafts: true })).toEqual(
			expect.arrayContaining(['draft', 'flagged', 'stale', 'human_approved', 'ai_verified'])
		);
		expect(allowedReviews('content')).toEqual(['human_approved']);
		expect(allowedReviews('content', { allowAiVerifiedInContent: true })).toEqual(['human_approved', 'ai_verified']);
	});

	it('never lets drafts into public content, whatever the options say', () => {
		const opts = { includeDrafts: true, allowAiVerifiedInContent: true };
		for (const r of ['draft', 'flagged', 'stale'] as const) expect(isAllowed(r, 'content', opts)).toBe(false);
	});

	it('watermarks anything that is not fully human-approved', () => {
		expect(needsWatermark(['human_approved'])).toBe(false);
		expect(needsWatermark(['human_approved', 'ai_verified'])).toBe(true);
	});
});

describe('rank fusion', () => {
	it('rewards items ranked well in several lists', () => {
		const f = reciprocalRankFusion([{ keys: ['a', 'b', 'c'] }, { keys: ['c', 'b', 'd'] }]);
		// b and c appear in both lists, so both outrank the single-list items a and d
		expect(f.slice(0, 2).map((x) => x.key).sort()).toEqual(['b', 'c']);
		expect(f.map((x) => x.key).sort()).toEqual(['a', 'b', 'c', 'd']);
	});
});

describe('language detection', () => {
	it('detects Polish by diacritics or stopwords, English by stopwords', () => {
		expect(detectLocale('Jesteście ruskimi pachołkami').locale).toBe('pl');
		expect(detectLocale('to jest nie dla nas i się').locale).toBe('pl');
		expect(detectLocale('this is the end of the road for you').locale).toBe('en');
		expect(detectLocale('neutrality').confident).toBe(false);
	});
});

describe('two-tier retrieval', () => {
	it('answers an attack from an approved argument and returns its linked sources', async () => {
		const r = await retrieve({ query: 'Neutral countries are isolationists who refuse to help allies', context: 'shield' });
		expect(r.tier).toBe('arguments');
		expect(r.arguments[0].id).toBe(humanArg);
		expect(r.arguments.map((a) => a.id)).toContain(humanArg);
		expect(r.sources.map((s) => s.id)).toContain(hague);
		expect(r.arguments[0].match.lexical!.matched).toBeGreaterThanOrEqual(2);
	});

	it('shows AI-verified cards to the Shield with their review state (so the UI can badge them)', async () => {
		const r = await retrieve({ query: 'Neutrality is naive appeasement of aggressors', context: 'shield' });
		const hit = r.arguments.find((a) => a.id === aiArg);
		expect(hit?.review).toBe('ai_verified');
		expect(r.watermark).toBe(true);
	});

	it('excludes draft and flagged cards from the Shield unless drafts are requested', async () => {
		const q = 'Peace requires unilateral disarmament by everyone immediately';
		const normal = await retrieve({ query: q, context: 'shield' });
		expect(normal.arguments.map((a) => a.id)).not.toContain(flaggedArg);
		const withDrafts = await retrieve({ query: q, context: 'shield', trust: { includeDrafts: true } });
		expect(withDrafts.arguments.map((a) => a.id)).toContain(flaggedArg);
		expect(withDrafts.arguments.find((a) => a.id === flaggedArg)!.review).toBe('flagged');

		const d = await retrieve({ query: 'Pacifists ignore reality about sanctions embargo policy', context: 'shield' });
		expect(d.arguments.map((a) => a.id)).not.toContain(draftArg);
	});

	it('keeps AI-verified cards out of public content by default, and watermarks the override', async () => {
		const q = 'Neutrality is naive appeasement of aggressors';
		const strict = await retrieve({ query: q, context: 'content' });
		expect(strict.arguments.map((a) => a.id)).not.toContain(aiArg);
		expect(strict.watermark).toBe(false);
		const override = await retrieve({ query: q, context: 'content', trust: { allowAiVerifiedInContent: true } });
		expect(override.arguments.map((a) => a.id)).toContain(aiArg);
		expect(override.watermark).toBe(true);
	});

	it('drops content-context results entirely when only unapproved cards match', async () => {
		const r = await retrieve({
			query: 'Peace requires unilateral disarmament by everyone immediately',
			context: 'content',
			trust: { includeDrafts: true, allowAiVerifiedInContent: true }
		});
		expect(r.arguments.map((a) => a.id)).not.toContain(flaggedArg);
	});

	it('falls back to sources when no argument matches', async () => {
		const r = await retrieve({ query: 'war is no longer a fit instrument to repair the violation of justice', context: 'shield' });
		expect(r.tier).toBe('sources');
		expect(r.sources[0].id).toBe(piT);
		expect(r.sources[0].work).toBe('Pacem in Terris');
	});

	it('returns the deterministic "no strong source" state instead of guessing', async () => {
		const r = await retrieve({ query: 'best recipe for pierogi with mushrooms and onion', context: 'shield' });
		expect(r.tier).toBe('none');
		expect(r.reason).toBe('no_strong_source');
		expect(r.arguments).toEqual([]);
		expect(r.sources).toEqual([]);
	});

	it('does not retrieve draft sources', async () => {
		const r = await retrieve({ query: 'grain exports and tariffs reviewed by the committee', context: 'shield' });
		expect(r.sources.map((s) => s.id)).not.toContain(secretDraft);
		const d = await retrieve({ query: 'grain exports and tariffs reviewed by the committee', context: 'shield', trust: { includeDrafts: true } });
		expect(d.sources.map((s) => s.id)).toContain(secretDraft);
	});

	it('does not match on a single incidental word', async () => {
		const r = await retrieve({ query: 'territory of the moon colony budget', context: 'shield' });
		expect(r.sources.map((s) => s.id)).not.toContain(hague);
	});

	it('labels a source shown in another language than requested', async () => {
		const r = await retrieve({ query: 'war is no longer a fit instrument to repair the violation of justice', context: 'shield', outputLocale: 'pl' });
		expect(r.outputLocale).toBe('pl');
		expect(r.sources[0].locale).toBe('en');
		expect(r.sources[0].isFallback).toBe(true);
	});

	it('finds Polish sources through inflected Polish queries', async () => {
		const r = await retrieve({ query: 'Dlaczego twierdzicie że nienaruszalność terytorium państwa jest ważna?', context: 'shield' });
		expect(r.queryLocale).toBe('pl');
		expect(r.sources.map((s) => s.id)).toContain(plSource);
		expect(r.sources.find((s) => s.id === plSource)!.isFallback).toBe(false);
	});

	it('honours an explicit output locale different from the query locale', async () => {
		const r = await retrieve({ query: 'Neutral countries are isolationists who refuse to help allies', context: 'shield', outputLocale: 'en' });
		expect(r.outputLocale).toBe('en');
	});

	it('never crashes on hostile queries', async () => {
		for (const q of ['', '   ', '"" OR 1=1 --', 'NEAR( AND ) *', '\u0000']) {
			const r = await retrieve({ query: q, context: 'shield' });
			expect(r.tier).toBe('none');
		}
	});

	it('counts card usage for the review queue', async () => {
		const r = await retrieve({ query: 'Neutral countries are isolationists who refuse to help allies', context: 'shield' });
		recordUsage(r);
		recordUsage(r);
		const row = db.prepare("SELECT uses FROM card_usage WHERE owner_type = 'argument' AND owner_id = ?").get(humanArg) as { uses: number };
		expect(row.uses).toBe(2);
	});
});

describe('vector search', () => {
	it('indexes missing texts, ranks by cosine and can retrieve without lexical support', async () => {
		const n = await indexMissing(embedder);
		expect(n).toBeGreaterThan(0);
		expect(await indexMissing(embedder)).toBe(0);

		const q = await embedder.embedQuery('The territory of neutral Powers is inviolable');
		const hits = searchVectors(q, embedder.model, { ownerType: 'source' });
		expect(hits[0].ownerId).toBe(hague);

		const r = await retrieve({
			query: 'territory neutral powers inviolable',
			context: 'shield',
			embedder,
			thresholds: { lexicalMinRatio: 5, vectorMin: 0.3 } // lexical can never qualify → vector path only
		});
		expect(r.arguments.length + r.sources.length).toBeGreaterThan(0);
		const hit = [...r.arguments, ...r.sources][0];
		expect(hit.match?.cosine).toBeGreaterThanOrEqual(0.3);
	});

	it('drops a stale vector when the text changes and re-embeds it', async () => {
		await indexMissing(embedder);
		const count = () => (db.prepare('SELECT COUNT(*) AS c FROM embeddings WHERE owner_type = ? AND owner_id = ?').get('source', hague) as { c: number }).c;
		expect(count()).toBe(1);
		upsertSourceText(hague, 'en', { text: 'Neutral territory may never be crossed by belligerent armies.' }, human('alice'));
		expect(count()).toBe(0);
		await indexMissing(embedder);
		expect(count()).toBe(1);
	});

	it('reindexes everything for a model on demand', async () => {
		const total = await reindexAll(embedder);
		expect(total).toBeGreaterThan(0);
	});

	it('only uses vectors of the active model', () => {
		const q = new Float32Array(256).fill(0.0625);
		expect(searchVectors(q, 'some-other-model')).toEqual([]);
	});
});
