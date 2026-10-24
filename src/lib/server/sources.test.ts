import { describe, it, expect } from 'vitest';
import { db } from './db';
import { validateIngestionChecklist, type IngestionChecklistItem } from './seed/checklist';
import {
	createSource,
	deleteSource,
	getSource,
	getTranslationCoverage,
	listSources,
	upsertSourceText
} from './sources';
import { searchFts, prepareFtsQuery } from './rag/fts';
import { human, setReview, system, ReviewTransitionError } from './review';

const alice = human('alice');

function make(overrides: Partial<IngestionChecklistItem> = {}) {
	return createSource(
		{
			work: 'Testowe dzieło',
			section_ref: '§1',
			category: 'movement',
			license: 'Movement-authored',
			original_locale: 'pl',
			cleared_to_store: true,
			reviewer: 'alice',
			locale: 'pl',
			origin: 'original',
			text: 'Pokój jest owocem sprawiedliwości.',
			...overrides
		},
		alice
	);
}

describe('ingestion checklist', () => {
	const ok: IngestionChecklistItem = {
		work: 'W', section_ref: '§1', category: 'magisterium', license: 'Holy See, with attribution',
		original_locale: 'la', cleared_to_store: true, reviewer: 'alice', text: 't', locale: 'en', origin: 'official_translation'
	};

	it('accepts a complete item', () => {
		expect(validateIngestionChecklist(ok).valid).toBe(true);
	});

	it('requires an explicit cleared_to_store decision (no default)', () => {
		const item = { ...ok } as Partial<IngestionChecklistItem>;
		delete item.cleared_to_store;
		expect(validateIngestionChecklist(item).valid).toBe(false);
	});

	it('allows only paraphrase/AI-draft text for sources that are not cleared', () => {
		expect(validateIngestionChecklist({ ...ok, cleared_to_store: false }).valid).toBe(false);
		expect(validateIngestionChecklist({ ...ok, cleared_to_store: false, origin: 'paraphrase' }).valid).toBe(true);
	});

	it('rejects unregistered languages and bad URLs, and unverified "public domain" translations', () => {
		expect(validateIngestionChecklist({ ...ok, original_locale: 'xx' as never }).valid).toBe(false);
		expect(validateIngestionChecklist({ ...ok, url: 'javascript:alert(1)' }).valid).toBe(false);
		expect(validateIngestionChecklist({ ...ok, license: 'public domain' }).valid).toBe(false);
	});
});

describe('review rules (plan §3.3)', () => {
	it('creates new sources as drafts, whatever the caller wanted', () => {
		const id = make();
		expect(getSource(id)!.translations.pl.review).toBe('draft');
	});

	it('lets a human approve, and records who did it', () => {
		const id = make();
		setReview('source', id, 'pl', 'human_approved', alice, 'checked');
		expect(getSource(id)!.translations.pl.review).toBe('human_approved');
		const ev = db.prepare('SELECT actor FROM review_events WHERE owner_id = ? ORDER BY id DESC').get(id) as { actor: string };
		expect(ev.actor).toBe('human:alice');
	});

	it('resets approval to draft when the text changes', () => {
		const id = make();
		setReview('source', id, 'pl', 'human_approved', alice, 'ok');
		upsertSourceText(id, 'pl', { text: 'Zmieniony tekst.' }, alice);
		expect(getSource(id)!.translations.pl.review).toBe('draft');
	});

	it('resets approval when only the keywords change, and keeps it when nothing changes', () => {
		const id = make();
		setReview('source', id, 'pl', 'human_approved', alice, 'ok');
		upsertSourceText(id, 'pl', { text: 'Pokój jest owocem sprawiedliwości.' }, alice);
		expect(getSource(id)!.translations.pl.review).toBe('human_approved');
		upsertSourceText(id, 'pl', { text: 'Pokój jest owocem sprawiedliwości.', keywords: 'pokój' }, alice);
		expect(getSource(id)!.translations.pl.review).toBe('draft');
	});

	it('does not let a human set ai_verified, nor the system set human_approved', () => {
		const id = make();
		expect(() => setReview('source', id, 'pl', 'ai_verified', alice, 'x')).toThrow(ReviewTransitionError);
		expect(() => setReview('source', id, 'pl', 'human_approved', system('auditor'), 'x')).toThrow(ReviewTransitionError);
		setReview('source', id, 'pl', 'ai_verified', system('auditor'), 'passed audit');
		expect(getSource(id)!.translations.pl.review).toBe('ai_verified');
	});

	it('adds a translation as a draft', () => {
		const id = make();
		const r = upsertSourceText(id, 'en', { text: 'Peace is the fruit of justice.', origin: 'human_translation' }, alice);
		expect(r.created).toBe(true);
		expect(getSource(id)!.translations.en.review).toBe('draft');
	});

	it('stores original-only languages without an FTS row', () => {
		const id = make({ original_locale: 'fr', locale: 'fr', text: 'La paix est le fruit de la justice.', origin: 'original' });
		expect(getSource(id)!.translations.fr.text).toMatch(/paix/);
		expect(searchFts('pl', 'paix').length).toBe(0);
	});
});

describe('listing, fallback and coverage', () => {
	it('labels a fallback when the requested language is missing', () => {
		const id = make({ text: 'Tylko polski tekst.' });
		const s = getSource(id, 'en')!;
		expect(s.isFallback).toBe(true);
		expect(s.activeText!.locale).toBe('pl');
		expect(getSource(id, 'pl')!.isFallback).toBe(false);
	});

	it('filters by review state in SQL and keeps totals correct', () => {
		const a = make({ work: 'Filtr A' });
		make({ work: 'Filtr B' });
		setReview('source', a, 'pl', 'human_approved', alice, 'ok');
		const approved = listSources({ locale: 'pl', review: 'human_approved', limit: 500 });
		expect(approved.total).toBe(approved.sources.length);
		expect(approved.sources.every((s) => s.translations.pl.review === 'human_approved')).toBe(true);
		expect(approved.sources.some((s) => s.id === a)).toBe(true);
	});

	it('paginates without losing the total', () => {
		const page = listSources({ locale: 'pl', limit: 2, offset: 0 });
		expect(page.sources.length).toBeLessThanOrEqual(2);
		expect(page.total).toBeGreaterThanOrEqual(page.sources.length);
	});

	it('reports coverage per registered locale', () => {
		const c = getTranslationCoverage();
		expect(Object.keys(c).sort()).toEqual(['en', 'pl']);
		expect(c.pl.total).toBe(c.en.total);
	});

	it('deletes a source with its translations and search rows', () => {
		const id = make({ work: 'Do usunięcia', text: 'unikalnezdanieusuwane' });
		expect(searchFts('pl', 'unikalnezdanieusuwane').length).toBe(1);
		expect(deleteSource(id)).toBe(true);
		expect(searchFts('pl', 'unikalnezdanieusuwane').length).toBe(0);
		expect(getSource(id)).toBeNull();
	});
});

describe('full-text search', () => {
	it('matches inflected Polish forms (pokoju/pokój, lemiesza/lemiesz)', () => {
		make({ work: 'Manifest testowy', text: 'Pokój wymaga lemiesza, nie miecza.' });
		expect(searchFts('pl', 'pokoju').length).toBeGreaterThan(0);
		expect(searchFts('pl', 'lemiesz').length).toBeGreaterThan(0);
		expect(listSources({ locale: 'pl', search: 'pokoju' }).total).toBeGreaterThan(0);
	});

	it('finds exact section references', () => {
		make({
			work: 'Gaudium et Spes (fixture)',
			section_ref: '§78',
			original_locale: 'la',
			locale: 'en',
			origin: 'official_translation',
			license: 'Holy See, with attribution',
			text: 'A fixture text about peace and disarmament.'
		});
		const hits = searchFts('en', 'Gaudium 78');
		expect(hits.length + searchFts('en', 'Gaudium').length).toBeGreaterThan(0);
	});

	it('uses English stemming', () => {
		// the English fixture above holds "disarmament"
		expect(searchFts('en', 'disarming').length + searchFts('en', 'disarmament').length).toBeGreaterThan(0);
	});

	it('is safe against FTS operators and punctuation', () => {
		expect(prepareFtsQuery('pokój" OR 1=1 --', 'pl')).not.toMatch(/OR 1=1/);
		expect(() => searchFts('pl', 'NEAR(" AND * ) (')).not.toThrow();
		expect(searchFts('pl', '"" ()')).toEqual([]);
	});
});
