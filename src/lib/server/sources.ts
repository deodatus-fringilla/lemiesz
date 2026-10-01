import crypto from 'node:crypto';
import { db } from '$lib/server/db';
import {
	DEFAULT_LOCALE,
	LOCALE_CODES,
	isStorableLocale,
	type AnySupportedLocale,
	type Locale
} from '$lib/i18n/locales';
import { syncFts, removeFromAllFts, searchFts } from '$lib/server/rag/fts';
import { dropEmbedding } from '$lib/server/rag/vectors';
import {
	markDependentsStale,
	recordReviewEvent,
	type Actor,
	type Origin,
	type Review
} from '$lib/server/review';
import type { Category } from '$lib/server/seed/checklist';

export interface SourceRecord {
	id: number;
	work: string;
	section_ref: string;
	category: Category;
	url: string | null;
	license: string;
	cleared_to_store: number;
	original_locale: AnySupportedLocale;
	version: number;
	source_hash: string | null;
	updated_by: string | null;
	updated_at: string;
}

export interface SourceTextRecord {
	source_id: number;
	locale: AnySupportedLocale;
	text: string;
	keywords: string | null;
	origin: Origin;
	review: Review;
	translator: string | null;
	audit_json: string | null;
	audit_notes: string | null;
	drafter_model: string | null;
	auditor_model: string | null;
	prompt_version: string | null;
	source_hash: string | null;
}

export interface SourceWithTranslations extends SourceRecord {
	translations: Record<string, SourceTextRecord>;
	/** Text to show for the requested locale (may be a labelled fallback). */
	activeText?: SourceTextRecord;
	/** True when activeText is not in the requested locale (plan §8.2 j: must be labelled in the UI). */
	isFallback: boolean;
}

export interface CreateSourceInput {
	work: string;
	section_ref: string;
	category: Category;
	url?: string;
	license: string;
	cleared_to_store: boolean;
	original_locale: AnySupportedLocale;
	// Initial text row. Always created as `draft`: approval is a separate, human-only step.
	locale: AnySupportedLocale;
	text: string;
	keywords?: string;
	origin: Origin;
	translator?: string;
}

export interface SourceTextInput {
	text: string;
	keywords?: string | null;
	origin?: Origin;
	translator?: string | null;
	reason?: string;
}

export function computeHash(text: string): string {
	return crypto.createHash('sha256').update(text.trim()).digest('hex').substring(0, 16);
}

/** Picks the text to show: requested locale, else the original-language text, else anything (labelled as fallback). */
export function pickText(
	translations: Record<string, SourceTextRecord>,
	originalLocale: string,
	locale: string
): { row: SourceTextRecord | undefined; isFallback: boolean } {
	if (translations[locale]) return { row: translations[locale], isFallback: false };
	const fallback = translations[originalLocale] ?? Object.values(translations)[0];
	return { row: fallback, isFallback: true };
}

function ftsTitle(source: Pick<SourceRecord, 'work' | 'section_ref'>): string {
	return `${source.work} ${source.section_ref}`;
}

/** Creates a canonical source and its first text row. The row is always a `draft`. */
export function createSource(input: CreateSourceInput, actor: Actor): number {
	const hash = computeHash(input.text);

	return db.transaction(() => {
		const result = db
			.prepare(
				`INSERT INTO sources (work, section_ref, category, url, license, cleared_to_store,
					original_locale, version, source_hash, updated_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
			)
			.run(
				input.work.trim(),
				input.section_ref.trim(),
				input.category,
				input.url?.trim() || null,
				input.license.trim(),
				input.cleared_to_store ? 1 : 0,
				input.original_locale,
				hash,
				actor.name
			);
		const sourceId = Number(result.lastInsertRowid);

		db.prepare(
			`INSERT INTO source_texts (source_id, locale, text, keywords, origin, review, translator, source_hash)
			 VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`
		).run(
			sourceId,
			input.locale,
			input.text.trim(),
			input.keywords?.trim() || null,
			input.origin,
			input.translator?.trim() || null,
			hash
		);

		recordReviewEvent('source', sourceId, input.locale, 'draft', 'draft', actor, 'initial creation');
		syncFts(
			'source',
			sourceId,
			input.locale,
			ftsTitle(input),
			input.text.trim(),
			input.keywords?.trim() || null
		);
		return sourceId;
	})();
}

/**
 * Adds or edits one language's text for a source.
 * Plan §3.3: ANY change to the text or keywords resets that row to `draft` (a human must approve it
 * again), and AI-verified argument cards that depend on the source become `stale`.
 * The caller cannot choose the resulting review state.
 */
export function upsertSourceText(
	sourceId: number,
	locale: AnySupportedLocale,
	input: SourceTextInput,
	actor: Actor
): { changed: boolean; created: boolean } {
	if (!isStorableLocale(locale)) throw new Error(`Unknown locale "${locale}"`);
	const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId) as
		| SourceRecord
		| undefined;
	if (!source) throw new Error(`Source with ID ${sourceId} not found`);

	const existing = db
		.prepare('SELECT * FROM source_texts WHERE source_id = ? AND locale = ?')
		.get(sourceId, locale) as SourceTextRecord | undefined;

	const text = input.text.trim();
	if (!text) throw new Error('Text is required');
	const keywords = input.keywords === undefined ? (existing?.keywords ?? null) : input.keywords?.trim() || null;
	const hash = computeHash(text);

	return db.transaction(() => {
		if (!existing) {
			db.prepare(
				`INSERT INTO source_texts (source_id, locale, text, keywords, origin, review, translator, source_hash)
				 VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`
			).run(
				sourceId,
				locale,
				text,
				keywords,
				input.origin ?? 'human_translation',
				input.translator?.trim() || null,
				hash
			);
			recordReviewEvent('source', sourceId, locale, 'draft', 'draft', actor, input.reason ?? 'text added');
		} else {
			const changed = existing.text !== text || (existing.keywords ?? null) !== keywords;
			if (!changed && !input.origin && input.translator === undefined) {
				return { changed: false, created: false };
			}
			db.prepare(
				`UPDATE source_texts SET text = ?, keywords = ?, origin = ?, translator = ?, source_hash = ?,
					review = CASE WHEN ? THEN 'draft' ELSE review END
				 WHERE source_id = ? AND locale = ?`
			).run(
				text,
				keywords,
				input.origin ?? existing.origin,
				input.translator === undefined ? existing.translator : input.translator?.trim() || null,
				hash,
				changed ? 1 : 0,
				sourceId,
				locale
			);
			if (changed && existing.review !== 'draft') {
				recordReviewEvent(
					'source',
					sourceId,
					locale,
					existing.review,
					'draft',
					actor,
					input.reason ?? 'content edited: approval reset'
				);
			}
			if (changed) markDependentsStale(sourceId, `source ${sourceId}/${locale} was edited`);
		}

		db.prepare(
			`UPDATE sources SET version = version + 1, source_hash = ?, updated_by = ?, updated_at = datetime('now')
			 WHERE id = ?`
		).run(hash, actor.name, sourceId);

		syncFts('source', sourceId, locale, ftsTitle(source), text, keywords);
		dropEmbedding('source', sourceId, locale);
		return { changed: true, created: !existing };
	})();
}

function loadTranslations(sourceIds: number[]): Map<number, Record<string, SourceTextRecord>> {
	const map = new Map<number, Record<string, SourceTextRecord>>();
	if (sourceIds.length === 0) return map;
	const rows = db
		.prepare(
			`SELECT * FROM source_texts WHERE source_id IN (${sourceIds.map(() => '?').join(',')})`
		)
		.all(...sourceIds) as SourceTextRecord[];
	for (const t of rows) {
		const bucket = map.get(t.source_id) ?? {};
		bucket[t.locale] = t;
		map.set(t.source_id, bucket);
	}
	return map;
}

function hydrate(
	s: SourceRecord,
	translations: Record<string, SourceTextRecord> | undefined,
	locale: string
): SourceWithTranslations {
	const tr = translations ?? {};
	const { row, isFallback } = pickText(tr, s.original_locale, locale);
	return { ...s, translations: tr, activeText: row, isFallback };
}

export function getSource(sourceId: number, locale: string = DEFAULT_LOCALE): SourceWithTranslations | null {
	const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId) as
		| SourceRecord
		| undefined;
	if (!source) return null;
	return hydrate(source, loadTranslations([sourceId]).get(sourceId), locale);
}

export function deleteSource(sourceId: number): boolean {
	return db.transaction(() => {
		removeFromAllFts('source', sourceId);
		dropEmbedding('source', sourceId);
		db.prepare("DELETE FROM card_usage WHERE owner_type = 'source' AND owner_id = ?").run(sourceId);
		return db.prepare('DELETE FROM sources WHERE id = ?').run(sourceId).changes > 0;
	})();
}

export interface ListOptions {
	category?: string;
	locale?: Locale;
	/** Filters on the review state of the row in `locale`. */
	review?: string;
	clearedOnly?: boolean;
	search?: string;
	limit?: number;
	offset?: number;
}

/** Lists sources. Search uses the locale's FTS table (same query builder as retrieval); filters run in SQL. */
export function listSources(options: ListOptions = {}): { sources: SourceWithTranslations[]; total: number } {
	const locale = options.locale ?? DEFAULT_LOCALE;
	const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
	const offset = Math.max(options.offset ?? 0, 0);

	const where: string[] = [];
	const params: (string | number)[] = [];
	if (options.category) {
		where.push('s.category = ?');
		params.push(options.category);
	}
	if (options.clearedOnly) where.push('s.cleared_to_store = 1');
	if (options.review) {
		where.push(
			'EXISTS (SELECT 1 FROM source_texts t WHERE t.source_id = s.id AND t.locale = ? AND t.review = ?)'
		);
		params.push(locale, options.review);
	}

	let hitOrder: number[] | null = null;
	if (options.search?.trim()) {
		hitOrder = searchFts(locale, options.search, { ownerType: 'source', limit: 500 }).map(
			(h) => h.owner_id
		);
		if (hitOrder.length === 0) return { sources: [], total: 0 };
		where.push(`s.id IN (${hitOrder.map(() => '?').join(',')})`);
		params.push(...hitOrder);
	}

	const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
	let rows: SourceRecord[];
	let total: number;

	if (hitOrder) {
		// Relevance order comes from BM25, so paginate after re-ordering.
		const all = db.prepare(`SELECT s.* FROM sources s ${whereSql}`).all(...params) as SourceRecord[];
		const position = new Map(hitOrder.map((id, i) => [id, i]));
		all.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
		total = all.length;
		rows = all.slice(offset, offset + limit);
	} else {
		total = (
			db.prepare(`SELECT COUNT(*) AS count FROM sources s ${whereSql}`).get(...params) as { count: number }
		).count;
		rows = db
			.prepare(`SELECT s.* FROM sources s ${whereSql} ORDER BY s.id DESC LIMIT ? OFFSET ?`)
			.all(...params, limit, offset) as SourceRecord[];
	}

	const translations = loadTranslations(rows.map((r) => r.id));
	return { sources: rows.map((r) => hydrate(r, translations.get(r.id), locale)), total };
}

export interface Coverage {
	total: number;
	translated: number;
	approved: number;
	percentage: number;
}

/** Translation coverage per registered locale — the editorial to-do list (plan §6, §8.2 o). */
export function getTranslationCoverage(): Record<Locale, Coverage> {
	const total = (db.prepare('SELECT COUNT(*) AS count FROM sources').get() as { count: number }).count;
	const rows = db
		.prepare(
			`SELECT locale, COUNT(*) AS translated,
				SUM(CASE WHEN review = 'human_approved' THEN 1 ELSE 0 END) AS approved
			 FROM source_texts GROUP BY locale`
		)
		.all() as { locale: string; translated: number; approved: number }[];
	const byLocale = new Map(rows.map((r) => [r.locale, r]));

	const coverage = {} as Record<Locale, Coverage>;
	for (const loc of LOCALE_CODES) {
		const r = byLocale.get(loc);
		const translated = r?.translated ?? 0;
		coverage[loc] = {
			total,
			translated,
			approved: r?.approved ?? 0,
			percentage: total === 0 ? 0 : Math.round((translated / total) * 100)
		};
	}
	return coverage;
}
