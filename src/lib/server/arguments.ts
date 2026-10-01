import { db } from '$lib/server/db';
import { DEFAULT_LOCALE, isStorableLocale, type Locale } from '$lib/i18n/locales';
import { removeFromAllFts, searchFts, syncFts } from '$lib/server/rag/fts';
import { dropEmbedding } from '$lib/server/rag/vectors';
import { recordReviewEvent, type Actor, type Origin, type Review } from '$lib/server/review';
import { computeHash } from '$lib/server/sources';

export interface ArgumentRecord {
	id: number;
	fallacy_type: string | null;
	core_principle: string;
	tags: string | null;
	updated_by: string | null;
	updated_at: string;
}

export interface SupportingSpan {
	source_id: number;
	span: string;
}

export interface ArgumentTextRecord {
	argument_id: number;
	locale: string;
	opponent_claim: string;
	counter_punch: string;
	keywords: string | null;
	origin: Origin;
	review: Review;
	supporting_spans_json: string | null;
	audit_json: string | null;
	audit_notes: string | null;
	drafter_model: string | null;
	auditor_model: string | null;
	prompt_version: string | null;
	source_hash: string | null;
	audited_at: string | null;
}

export interface ArgumentWithTexts extends ArgumentRecord {
	texts: Record<string, ArgumentTextRecord>;
	source_ids: number[];
	activeText?: ArgumentTextRecord;
	isFallback: boolean;
}

export interface ArgumentTextInput {
	opponent_claim: string;
	counter_punch: string;
	keywords?: string | null;
	origin?: Origin;
	spans?: SupportingSpan[];
	reason?: string;
}

export interface CreateArgumentInput extends ArgumentTextInput {
	fallacy_type?: string | null;
	core_principle: string;
	tags?: string | null;
	locale: string;
	source_ids: number[];
}

/** Hash of the linked source texts: changes when a supporting source changes (used for staleness). */
export function linkedSourcesHash(sourceIds: number[]): string {
	if (sourceIds.length === 0) return computeHash('');
	const rows = db
		.prepare(
			`SELECT source_id, locale, source_hash FROM source_texts
			 WHERE source_id IN (${sourceIds.map(() => '?').join(',')}) ORDER BY source_id, locale`
		)
		.all(...sourceIds) as { source_id: number; locale: string; source_hash: string | null }[];
	return computeHash(rows.map((r) => `${r.source_id}/${r.locale}/${r.source_hash}`).join('|'));
}

function syncArgumentFts(argumentId: number, locale: string, t: {
	opponent_claim: string;
	counter_punch: string;
	keywords: string | null;
}) {
	syncFts('argument', argumentId, locale, t.opponent_claim, t.counter_punch, t.keywords);
}

function setLinks(argumentId: number, sourceIds: number[]): void {
	db.prepare('DELETE FROM argument_sources WHERE argument_id = ?').run(argumentId);
	const ins = db.prepare('INSERT OR IGNORE INTO argument_sources (argument_id, source_id) VALUES (?, ?)');
	for (const id of new Set(sourceIds)) ins.run(argumentId, id);
}

export function getLinkedSourceIds(argumentId: number): number[] {
	return (
		db.prepare('SELECT source_id FROM argument_sources WHERE argument_id = ? ORDER BY source_id').all(argumentId) as {
			source_id: number;
		}[]
	).map((r) => r.source_id);
}

/** Creates an argument card with its first text row. Always a draft: approval is separate (plan §3.3). */
export function createArgument(input: CreateArgumentInput, actor: Actor, meta: Partial<Pick<ArgumentTextRecord,
	'drafter_model' | 'prompt_version'>> = {}): number {
	if (!isStorableLocale(input.locale)) throw new Error(`Unknown locale "${input.locale}"`);
	if (!input.opponent_claim?.trim() || !input.counter_punch?.trim() || !input.core_principle?.trim()) {
		throw new Error('opponent_claim, counter_punch and core_principle are required');
	}
	return db.transaction(() => {
		const res = db
			.prepare('INSERT INTO arguments (fallacy_type, core_principle, tags, updated_by) VALUES (?, ?, ?, ?)')
			.run(input.fallacy_type ?? null, input.core_principle.trim(), input.tags ?? null, actor.name);
		const id = Number(res.lastInsertRowid);
		setLinks(id, input.source_ids);
		const keywords = input.keywords?.trim() || null;
		db.prepare(
			`INSERT INTO argument_texts (argument_id, locale, opponent_claim, counter_punch, keywords, origin, review,
				supporting_spans_json, drafter_model, prompt_version, source_hash)
			 VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`
		).run(
			id,
			input.locale,
			input.opponent_claim.trim(),
			input.counter_punch.trim(),
			keywords,
			input.origin ?? 'original',
			input.spans ? JSON.stringify(input.spans) : null,
			meta.drafter_model ?? null,
			meta.prompt_version ?? null,
			linkedSourcesHash(input.source_ids)
		);
		recordReviewEvent('argument', id, input.locale, 'draft', 'draft', actor, input.reason ?? 'initial creation');
		syncArgumentFts(id, input.locale, {
			opponent_claim: input.opponent_claim.trim(),
			counter_punch: input.counter_punch.trim(),
			keywords
		});
		return id;
	})();
}

/**
 * Adds or edits one language's card text. Any change to the claim, the counter-punch or the keywords
 * resets that row to `draft` (plan §3.3); the caller cannot choose the resulting state.
 */
export function upsertArgumentText(
	argumentId: number,
	locale: string,
	input: ArgumentTextInput,
	actor: Actor
): { changed: boolean; created: boolean } {
	if (!isStorableLocale(locale)) throw new Error(`Unknown locale "${locale}"`);
	if (!db.prepare('SELECT 1 FROM arguments WHERE id = ?').get(argumentId)) {
		throw new Error(`Argument ${argumentId} not found`);
	}
	const claim = input.opponent_claim.trim();
	const punch = input.counter_punch.trim();
	if (!claim || !punch) throw new Error('opponent_claim and counter_punch are required');

	const existing = db
		.prepare('SELECT * FROM argument_texts WHERE argument_id = ? AND locale = ?')
		.get(argumentId, locale) as ArgumentTextRecord | undefined;
	const keywords = input.keywords === undefined ? (existing?.keywords ?? null) : input.keywords?.trim() || null;
	const hash = linkedSourcesHash(getLinkedSourceIds(argumentId));

	return db.transaction(() => {
		if (!existing) {
			db.prepare(
				`INSERT INTO argument_texts (argument_id, locale, opponent_claim, counter_punch, keywords, origin, review,
					supporting_spans_json, source_hash)
				 VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
			).run(argumentId, locale, claim, punch, keywords, input.origin ?? 'human_translation',
				input.spans ? JSON.stringify(input.spans) : null, hash);
			recordReviewEvent('argument', argumentId, locale, 'draft', 'draft', actor, input.reason ?? 'text added');
		} else {
			const changed =
				existing.opponent_claim !== claim || existing.counter_punch !== punch || (existing.keywords ?? null) !== keywords;
			if (!changed && !input.origin) return { changed: false, created: false };
			db.prepare(
				`UPDATE argument_texts SET opponent_claim = ?, counter_punch = ?, keywords = ?, origin = ?,
					supporting_spans_json = COALESCE(?, supporting_spans_json), source_hash = ?,
					audit_json = CASE WHEN ? THEN NULL ELSE audit_json END,
					review = CASE WHEN ? THEN 'draft' ELSE review END
				 WHERE argument_id = ? AND locale = ?`
			).run(claim, punch, keywords, input.origin ?? existing.origin,
				input.spans ? JSON.stringify(input.spans) : null, hash, changed ? 1 : 0, changed ? 1 : 0, argumentId, locale);
			if (changed && existing.review !== 'draft') {
				recordReviewEvent('argument', argumentId, locale, existing.review, 'draft', actor,
					input.reason ?? 'content edited: approval reset');
			}
		}
		db.prepare("UPDATE arguments SET updated_by = ?, updated_at = datetime('now') WHERE id = ?").run(actor.name, argumentId);
		syncArgumentFts(argumentId, locale, { opponent_claim: claim, counter_punch: punch, keywords });
		dropEmbedding('argument', argumentId, locale);
		return { changed: true, created: !existing };
	})();
}

/** Changes which sources support a card. Any change sends every language of the card back to draft. */
export function setArgumentSources(argumentId: number, sourceIds: number[], actor: Actor): boolean {
	const before = getLinkedSourceIds(argumentId);
	const after = [...new Set(sourceIds)].sort((a, b) => a - b);
	if (before.join(',') === after.join(',')) return false;
	db.transaction(() => {
		setLinks(argumentId, after);
		const rows = db
			.prepare('SELECT locale, review FROM argument_texts WHERE argument_id = ?')
			.all(argumentId) as { locale: string; review: Review }[];
		for (const r of rows) {
			if (r.review !== 'draft') {
				db.prepare("UPDATE argument_texts SET review = 'draft', audit_json = NULL WHERE argument_id = ? AND locale = ?")
					.run(argumentId, r.locale);
				recordReviewEvent('argument', argumentId, r.locale, r.review, 'draft', actor, 'supporting sources changed');
			}
		}
		db.prepare('UPDATE argument_texts SET source_hash = ? WHERE argument_id = ?').run(linkedSourcesHash(after), argumentId);
		db.prepare("UPDATE arguments SET updated_by = ?, updated_at = datetime('now') WHERE id = ?").run(actor.name, argumentId);
	})();
	return true;
}

function hydrate(a: ArgumentRecord, texts: ArgumentTextRecord[], sourceIds: number[], locale: string): ArgumentWithTexts {
	const map: Record<string, ArgumentTextRecord> = {};
	for (const t of texts) map[t.locale] = t;
	const exact = map[locale];
	return { ...a, texts: map, source_ids: sourceIds, activeText: exact ?? texts[0], isFallback: !exact };
}

export function getArgument(id: number, locale: string = DEFAULT_LOCALE): ArgumentWithTexts | null {
	const a = db.prepare('SELECT * FROM arguments WHERE id = ?').get(id) as ArgumentRecord | undefined;
	if (!a) return null;
	const texts = db.prepare('SELECT * FROM argument_texts WHERE argument_id = ?').all(id) as ArgumentTextRecord[];
	return hydrate(a, texts, getLinkedSourceIds(id), locale);
}

export function deleteArgument(id: number): boolean {
	return db.transaction(() => {
		removeFromAllFts('argument', id);
		dropEmbedding('argument', id);
		db.prepare("DELETE FROM card_usage WHERE owner_type = 'argument' AND owner_id = ?").run(id);
		return db.prepare('DELETE FROM arguments WHERE id = ?').run(id).changes > 0;
	})();
}

export function listArguments(options: {
	locale?: Locale;
	review?: string;
	search?: string;
	limit?: number;
	offset?: number;
} = {}): { arguments: ArgumentWithTexts[]; total: number } {
	const locale = options.locale ?? DEFAULT_LOCALE;
	const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
	const offset = Math.max(options.offset ?? 0, 0);
	const where: string[] = [];
	const params: (string | number)[] = [];

	if (options.review) {
		where.push('EXISTS (SELECT 1 FROM argument_texts t WHERE t.argument_id = a.id AND t.locale = ? AND t.review = ?)');
		params.push(locale, options.review);
	}
	let hitOrder: number[] | null = null;
	if (options.search?.trim()) {
		hitOrder = searchFts(locale, options.search, { ownerType: 'argument', limit: 500 }).map((h) => h.owner_id);
		if (hitOrder.length === 0) return { arguments: [], total: 0 };
		where.push(`a.id IN (${hitOrder.map(() => '?').join(',')})`);
		params.push(...hitOrder);
	}
	const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
	let rows: ArgumentRecord[];
	let total: number;
	if (hitOrder) {
		const all = db.prepare(`SELECT a.* FROM arguments a ${whereSql}`).all(...params) as ArgumentRecord[];
		const pos = new Map(hitOrder.map((id, i) => [id, i]));
		all.sort((x, y) => (pos.get(x.id) ?? 0) - (pos.get(y.id) ?? 0));
		total = all.length;
		rows = all.slice(offset, offset + limit);
	} else {
		total = (db.prepare(`SELECT COUNT(*) AS c FROM arguments a ${whereSql}`).get(...params) as { c: number }).c;
		rows = db.prepare(`SELECT a.* FROM arguments a ${whereSql} ORDER BY a.id DESC LIMIT ? OFFSET ?`)
			.all(...params, limit, offset) as ArgumentRecord[];
	}
	const ids = rows.map((r) => r.id);
	const texts = ids.length
		? (db.prepare(`SELECT * FROM argument_texts WHERE argument_id IN (${ids.map(() => '?').join(',')})`).all(...ids) as ArgumentTextRecord[])
		: [];
	const links = ids.length
		? (db.prepare(`SELECT argument_id, source_id FROM argument_sources WHERE argument_id IN (${ids.map(() => '?').join(',')})`).all(...ids) as {
				argument_id: number;
				source_id: number;
			}[])
		: [];
	return {
		arguments: rows.map((r) =>
			hydrate(r, texts.filter((t) => t.argument_id === r.id), links.filter((l) => l.argument_id === r.id).map((l) => l.source_id), locale)
		),
		total
	};
}
