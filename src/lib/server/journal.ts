import { db } from '$lib/server/db';
import { readingMinutes } from '$lib/reading-time';
import type { Actor } from '$lib/server/review';
import { slugify } from '$lib/server/media';
import { findCitationProblems } from '$lib/server/journal-citations';
import { findImageProblems } from '$lib/server/journal-images';
import { findMediaProblems } from '$lib/server/journal-media';
import { prepareFtsQuery } from '$lib/server/rag/fts';
import { DEV_USERNAME, authDisabled } from '$lib/server/auth';
import { BlockError, blocksFromMarkdown, flattenBlocks, isLayoutColumns, parseStoredBlocks, validateBlocks, type Block, type LayoutColumns } from '$lib/journal-blocks';

/** Blocks from the caller (block editor) or a Markdown body (plain editor, pipeline), validated; JournalError on problems. */
function toBlocks(input: { blocks?: unknown; body?: string }): Block[] {
	try {
		// A draft may start empty (the new-article form only asks for the title); approval requires content.
		return validateBlocks(input.blocks !== undefined ? input.blocks : input.body?.trim() ? blocksFromMarkdown(input.body) : [], { allowEmpty: true });
	} catch (e) {
		if (e instanceof BlockError) throw new JournalError(e.message);
		throw e;
	}
}

/**
 * Approvals that count toward publishing. With real accounts on, an approval made in development mode (the shared
 * "dev" identity) is not a person and does not count; otherwise one real editor plus an old "dev" approval would pass
 * the two-person rule for heavy calibre.
 */
function countedApprovals(articleId: number, locale: string, revision: number): number {
	const exclude = authDisabled() ? '' : ' AND approved_by <> ?';
	const params: unknown[] = [articleId, locale, revision, ...(authDisabled() ? [] : [DEV_USERNAME])];
	return (db.prepare(`SELECT COUNT(*) AS n FROM journal_approvals WHERE article_id = ? AND locale = ? AND revision = ?${exclude}`).get(...params) as { n: number }).n;
}

/** Approvals of the current revision that count, for the editors' screens. */
export function countedApprovalsOf(articleId: number, locale: string): number {
	const text = getText(articleId, locale);
	return text ? countedApprovals(articleId, locale, text.revision) : 0;
}

/**
 * Journal "Lemiesz. Czy Neutralność jest możliwa? Rozprawy geoideologiczne" — articles (rozprawy).
 * Trust rules as everywhere: only signed-in humans approve or publish; any edit resets the working copy to draft.
 * Readers see a separately stored published version, so fixing a typo never takes a live article offline:
 * the fix goes live only when its own revision is approved and published.
 */
export const CALIBERS = ['light', 'heavy'] as const;
export type Caliber = (typeof CALIBERS)[number];
export type TextStatus = 'draft' | 'human_approved' | 'flagged';

export class JournalError extends Error {}

/** Media types offered for Biblioteka links (a subset of MEDIA_TYPES). */
export const LINK_TYPES = ['article', 'podcast', 'film', 'video', 'painting', 'music', 'poetry', 'speech'] as const;

/** Distinct human approvals a revision needs: one for light calibre, two for heavy (JOURNAL_HEAVY_REVIEWERS overrides). */
export function requiredApprovals(caliber: Caliber): number {
	if (caliber === 'light') return 1;
	const n = Number(process.env.JOURNAL_HEAVY_REVIEWERS ?? 2);
	return Number.isInteger(n) && n >= 1 ? n : 2;
}

export interface Article {
	id: number;
	slug: string;
	caliber: Caliber;
	twin_id: number | null;
	author: string | null;
	tags: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
}

export interface ArticleText {
	article_id: number;
	locale: string;
	title: string;
	lead: string;
	body: string;
	revision: number;
	status: TextStatus;
	ai_assisted: boolean;
	published_title: string | null;
	published_lead: string | null;
	published_body: string | null;
	published_revision: number | null;
	published_at: string | null;
	published_by: string | null;
	updated_at: string;
	/** The article as blocks (working copy); `body` is derived from them. */
	blocks: Block[];
	/** One column, or two (the text flows from the first into the second). Working copy. */
	layout_columns: LayoutColumns;
	published_layout_columns: LayoutColumns | null;
}

type TextRow = Omit<ArticleText, 'ai_assisted' | 'blocks'> & { ai_assisted: number; blocks_json: string | null; published_blocks_json: string | null };
const fromText = ({ blocks_json, published_blocks_json: _published, ...r }: TextRow): ArticleText => ({
	...r,
	ai_assisted: !!r.ai_assisted,
	blocks: parseStoredBlocks(blocks_json, r.body)
});

const requireHuman = (actor: Actor, what: string) => {
	if (actor.kind !== 'human') throw new JournalError(`${actor.kind} "${actor.name}" may not ${what}`);
};

/** Slugs that are pages of their own under /czasopismo, so no article may take them. */
const RESERVED_SLUGS = new Set(['sledz']);

function uniqueSlug(base: string, ownId?: number): string {
	let slug = base || 'rozprawa';
	for (let n = 2; ; n++) {
		const row = db.prepare('SELECT id FROM journal_articles WHERE slug = ?').get(slug) as { id: number } | undefined;
		if (!RESERVED_SLUGS.has(slug) && (!row || row.id === ownId)) return slug;
		slug = `${base}-${n}`;
	}
}

export function getArticle(id: number): Article | null {
	return (db.prepare('SELECT * FROM journal_articles WHERE id = ?').get(id) as Article | undefined) ?? null;
}

export function getText(articleId: number, locale: string): ArticleText | null {
	const r = db.prepare('SELECT * FROM journal_article_texts WHERE article_id = ? AND locale = ?').get(articleId, locale) as TextRow | undefined;
	return r ? fromText(r) : null;
}

export interface NewArticle {
	caliber: Caliber;
	locale: string;
	title: string;
	lead?: string;
	body?: string;
	/** Block-editor content; when given it replaces `body`. */
	blocks?: unknown;
	/** One column (default) or two. */
	columns?: unknown;
	slug?: string;
	author?: string | null;
	tags?: string | null;
	ai_assisted?: boolean;
}

/** Creates an article with its first text. Always a draft. A non-human author (the pipeline) means AI-assisted. */
export function createArticle(input: NewArticle, actor: Actor): number {
	if (!(CALIBERS as readonly string[]).includes(input.caliber)) throw new JournalError(`Calibre must be one of: ${CALIBERS.join(', ')}`);
	if (!input.title?.trim()) throw new JournalError('Title is required');
	const blocks = toBlocks(input);
	return db.transaction(() => {
		const slug = uniqueSlug(slugify(input.slug?.trim() || input.title));
		const id = Number(
			db
				.prepare('INSERT INTO journal_articles (slug, caliber, author, tags, created_by) VALUES (?, ?, ?, ?, ?)')
				.run(slug, input.caliber, input.author?.trim() || null, input.tags?.trim() || null, actor.name).lastInsertRowid
		);
		db.prepare('INSERT INTO journal_article_texts (article_id, locale, title, lead, body, blocks_json, layout_columns, ai_assisted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
			id, input.locale, input.title.trim(), input.lead?.trim() ?? '', flattenBlocks(blocks), JSON.stringify(blocks), isLayoutColumns(input.columns) ? input.columns : 1, input.ai_assisted || actor.kind !== 'human' ? 1 : 0
		);
		return id;
	})();
}

/**
 * Saves the working copy of one language (adds the language if it is new). Any real change bumps the revision and
 * resets the status to draft; the published version is untouched until the new revision is approved and published.
 */
export function saveText(
	articleId: number,
	locale: string,
	input: { title: string; lead?: string; body?: string; blocks?: unknown; columns?: unknown; ai_assisted?: boolean },
	actor: Actor
): { changed: boolean; revision: number } {
	if (!getArticle(articleId)) throw new JournalError(`Article ${articleId} not found`);
	if (!input.title?.trim()) throw new JournalError('Title is required');
	const blocks = toBlocks(input);
	const blocksJson = JSON.stringify(blocks);
	const body = flattenBlocks(blocks);
	const ai = input.ai_assisted || actor.kind !== 'human' ? 1 : 0;
	const current = getText(articleId, locale);
	// Callers that do not know about layouts (the pipeline, old forms) leave it as it is.
	const layout: LayoutColumns = isLayoutColumns(input.columns) ? input.columns : (current?.layout_columns ?? 1);
	if (!current) {
		db.prepare('INSERT INTO journal_article_texts (article_id, locale, title, lead, body, blocks_json, layout_columns, ai_assisted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
			articleId, locale, input.title.trim(), input.lead?.trim() ?? '', body, blocksJson, layout, ai
		);
		return { changed: true, revision: 1 };
	}
	const same = current.title === input.title.trim() && current.lead === (input.lead?.trim() ?? '') && JSON.stringify(current.blocks) === blocksJson && current.layout_columns === layout;
	if (same && (current.ai_assisted ? 1 : 0) === ai) return { changed: false, revision: current.revision };
	const revision = current.revision + 1;
	db.prepare(
		`UPDATE journal_article_texts SET title = ?, lead = ?, body = ?, blocks_json = ?, layout_columns = ?, ai_assisted = ?, revision = ?, status = 'draft',
			updated_at = datetime('now') WHERE article_id = ? AND locale = ?`
	).run(input.title.trim(), input.lead?.trim() ?? '', body, blocksJson, layout, ai, revision, articleId, locale);
	return { changed: true, revision };
}

/**
 * Changes calibre, author or tags. A calibre change alters who must approve, so every language's working copy gets a
 * new revision (earlier approvals no longer count) and a twin of the new calibre is unlinked.
 */
export function updateArticleMeta(id: number, input: { caliber?: Caliber; author?: string | null; tags?: string | null }, actor: Actor): void {
	requireHuman(actor, 'edit journal articles');
	const a = getArticle(id);
	if (!a) throw new JournalError(`Article ${id} not found`);
	const caliber = input.caliber ?? a.caliber;
	if (!(CALIBERS as readonly string[]).includes(caliber)) throw new JournalError(`Calibre must be one of: ${CALIBERS.join(', ')}`);
	const author = input.author === undefined ? a.author : input.author?.trim() || null;
	const tags = input.tags === undefined ? a.tags : input.tags?.trim() || null;
	db.transaction(() => {
		db.prepare("UPDATE journal_articles SET caliber = ?, author = ?, tags = ?, updated_at = datetime('now') WHERE id = ?").run(caliber, author, tags, id);
		if (caliber !== a.caliber) {
			db.prepare("UPDATE journal_article_texts SET revision = revision + 1, status = 'draft', updated_at = datetime('now') WHERE article_id = ?").run(id);
			const twin = a.twin_id ? getArticle(a.twin_id) : null;
			if (twin && twin.caliber === caliber) db.prepare('UPDATE journal_articles SET twin_id = NULL WHERE id IN (?, ?)').run(id, twin.id);
		}
	})();
}

export function listLocales(articleId: number): string[] {
	return (db.prepare('SELECT locale FROM journal_article_texts WHERE article_id = ? ORDER BY locale DESC').all(articleId) as { locale: string }[]).map((r) => r.locale);
}

/** Who approved the current revision of one language. */
export function listApprovals(articleId: number, locale: string): { approved_by: string; approved_at: string }[] {
	const text = getText(articleId, locale);
	if (!text) return [];
	return db
		.prepare('SELECT approved_by, approved_at FROM journal_approvals WHERE article_id = ? AND locale = ? AND revision = ? ORDER BY approved_at')
		.all(articleId, locale, text.revision) as { approved_by: string; approved_at: string }[];
}

/** Articles of the other calibre that could be this one's twin, with a title in the given language if there is one. */
export function twinCandidates(articleId: number, locale: string): { id: number; title: string }[] {
	const a = getArticle(articleId);
	if (!a) return [];
	return db
		.prepare(
			`SELECT j.id, COALESCE(
				(SELECT title FROM journal_article_texts t WHERE t.article_id = j.id AND t.locale = ?),
				(SELECT title FROM journal_article_texts t WHERE t.article_id = j.id ORDER BY t.locale DESC LIMIT 1)) AS title
			 FROM journal_articles j WHERE j.caliber <> ? AND j.id <> ? ORDER BY j.updated_at DESC`
		)
		.all(locale, a.caliber, a.id) as { id: number; title: string }[];
}

/** Records one person's approval of the current revision; the text becomes human_approved once enough people agree. */
export function approveText(articleId: number, locale: string, actor: Actor): { approvals: number; required: number; approved: boolean } {
	requireHuman(actor, 'approve journal articles');
	const article = getArticle(articleId);
	const text = getText(articleId, locale);
	if (!article || !text) throw new JournalError(`Article ${articleId} (${locale}) not found`);
	if (text.status === 'flagged') throw new JournalError('A flagged text must be edited before it can be approved');
	if (!text.body.trim()) throw new JournalError('The article is empty: write something before approving it');
	const problems = findCitationProblems(text.body, locale);
	if (problems.length) throw new JournalError(`Citations that do not resolve to approved sources: ${problems.map((p) => p.token).join(', ')}`);
	const imageProblems = [...findImageProblems(text.blocks, locale), ...findMediaProblems(text.blocks)];
	if (imageProblems.length) throw new JournalError(`Images or media not ready: ${imageProblems.join('; ')}`);
	const required = requiredApprovals(article.caliber);
	return db.transaction(() => {
		db.prepare('INSERT OR IGNORE INTO journal_approvals (article_id, locale, revision, approved_by) VALUES (?, ?, ?, ?)').run(
			articleId, locale, text.revision, actor.name
		);
		const approvals = countedApprovals(articleId, locale, text.revision);
		const approved = approvals >= required;
		if (approved) db.prepare("UPDATE journal_article_texts SET status = 'human_approved' WHERE article_id = ? AND locale = ?").run(articleId, locale);
		return { approvals, required, approved };
	})();
}

export function flagText(articleId: number, locale: string, actor: Actor): void {
	requireHuman(actor, 'flag journal articles');
	const r = db.prepare("UPDATE journal_article_texts SET status = 'flagged', updated_at = datetime('now') WHERE article_id = ? AND locale = ?").run(articleId, locale);
	if (!r.changes) throw new JournalError(`Article ${articleId} (${locale}) not found`);
}

/** Takes back "needs changes" without editing: the text returns to review, and its approvals still count. */
export function unflagText(articleId: number, locale: string, actor: Actor): void {
	requireHuman(actor, 'unflag journal articles');
	const r = db.prepare("UPDATE journal_article_texts SET status = 'draft', updated_at = datetime('now') WHERE article_id = ? AND locale = ? AND status = 'flagged'").run(articleId, locale);
	if (!r.changes) throw new JournalError(`Article ${articleId} (${locale}) is not flagged`);
}

/** Puts the approved current revision online. Refuses anything not approved by enough people for this calibre. */
export function publishText(articleId: number, locale: string, actor: Actor): void {
	requireHuman(actor, 'publish journal articles');
	const article = getArticle(articleId);
	const text = getText(articleId, locale);
	if (!article || !text) throw new JournalError(`Article ${articleId} (${locale}) not found`);
	const approvals = countedApprovals(articleId, locale, text.revision);
	// Readiness is decided by the approvals that count right now, not by a status stored at approval time: if the
	// required number changes (JOURNAL_HEAVY_REVIEWERS), an already approved revision must not get stuck.
	if (text.status === 'flagged' || approvals < requiredApprovals(article.caliber)) {
		throw new JournalError(`Revision ${text.revision} is not approved (${approvals}/${requiredApprovals(article.caliber)} approvals)`);
	}
	// A cited source may have lost its approval since: check again at the moment of publishing.
	const problems = findCitationProblems(text.body, locale);
	if (problems.length) throw new JournalError(`Citations that no longer resolve to approved sources: ${problems.map((p) => p.token).join(', ')}`);
	// The same for images: one may have lost its approval or alternative text since the article was approved.
	const imageProblems = [...findImageProblems(text.blocks, locale), ...findMediaProblems(text.blocks)];
	if (imageProblems.length) throw new JournalError(`Images or media not ready: ${imageProblems.join('; ')}`);
	db.prepare(
		`UPDATE journal_article_texts SET status = 'human_approved', published_title = title, published_lead = lead, published_body = body,
			published_blocks_json = blocks_json, published_layout_columns = layout_columns, published_revision = revision, published_at = datetime('now'), published_by = ? WHERE article_id = ? AND locale = ?`
	).run(actor.name, articleId, locale);
}

export function unpublishText(articleId: number, locale: string, actor: Actor): void {
	requireHuman(actor, 'unpublish journal articles');
	db.prepare(
		`UPDATE journal_article_texts SET published_title = NULL, published_lead = NULL, published_body = NULL, published_blocks_json = NULL, published_layout_columns = NULL,
			published_revision = NULL, published_at = NULL, published_by = NULL WHERE article_id = ? AND locale = ?`
	).run(articleId, locale);
}

/** Links two articles of different calibres as twins (both directions); null clears the link. */
export function setTwin(articleId: number, twinId: number | null, actor: Actor): void {
	requireHuman(actor, 'link journal articles');
	const a = getArticle(articleId);
	if (!a) throw new JournalError(`Article ${articleId} not found`);
	db.transaction(() => {
		db.prepare('UPDATE journal_articles SET twin_id = NULL WHERE twin_id = ? OR id = ?').run(articleId, articleId);
		if (twinId === null) return;
		const b = getArticle(twinId);
		if (!b) throw new JournalError(`Article ${twinId} not found`);
		if (b.id === a.id) throw new JournalError('An article cannot be its own twin');
		if (b.caliber === a.caliber) throw new JournalError('Twins must be of different calibres (light and heavy)');
		db.prepare('UPDATE journal_articles SET twin_id = NULL WHERE twin_id = ? OR id = ?').run(b.id, b.id);
		db.prepare('UPDATE journal_articles SET twin_id = ? WHERE id = ?').run(b.id, a.id);
		db.prepare('UPDATE journal_articles SET twin_id = ? WHERE id = ?').run(a.id, b.id);
	})();
}

/** Deleting a live article would break readers' links: unpublish every language first. */
export function deleteArticle(id: number): boolean {
	if (db.prepare('SELECT 1 FROM journal_article_texts WHERE article_id = ? AND published_body IS NOT NULL').get(id)) {
		throw new JournalError('Unpublish the article in every language before deleting it');
	}
	return db.transaction(() => {
		db.prepare('UPDATE journal_articles SET twin_id = NULL WHERE twin_id = ?').run(id);
		return db.prepare('DELETE FROM journal_articles WHERE id = ?').run(id).changes > 0;
	})();
}

// ---- reading (published versions only) ---------------------------------------------------------------

export interface PublishedArticle {
	id: number;
	slug: string;
	caliber: Caliber;
	author: string | null;
	tags: string | null;
	locale: string;
	title: string;
	lead: string;
	body: string;
	published_at: string;
	/** The published version as blocks (what readers see). */
	blocks: Block[];
	/** Columns of the published layout. */
	columns: LayoutColumns;
	twin: { slug: string; caliber: Caliber; title: string } | null;
}

const PUBLISHED_SELECT = `
	SELECT a.id, a.slug, a.caliber, a.author, a.tags, t.locale, t.published_title AS title, t.published_lead AS lead,
		t.published_body AS body, t.published_blocks_json, COALESCE(t.published_layout_columns, 1) AS columns, t.published_at,
		tw.slug AS twin_slug, tw.caliber AS twin_caliber, tt.published_title AS twin_title
	FROM journal_article_texts t
	JOIN journal_articles a ON a.id = t.article_id
	LEFT JOIN journal_articles tw ON tw.id = a.twin_id
	LEFT JOIN journal_article_texts tt ON tt.article_id = tw.id AND tt.locale = t.locale AND tt.published_body IS NOT NULL
`;

type PublishedRow = Omit<PublishedArticle, 'twin' | 'blocks'> & {
	published_blocks_json: string | null;
	twin_slug: string | null;
	twin_caliber: Caliber | null;
	twin_title: string | null;
};
const fromPublished = ({ twin_slug, twin_caliber, twin_title, published_blocks_json, ...r }: PublishedRow): PublishedArticle => ({
	...r,
	blocks: parseStoredBlocks(published_blocks_json, r.body),
	twin: twin_slug && twin_title && twin_caliber ? { slug: twin_slug, caliber: twin_caliber, title: twin_title } : null
});

export function getPublishedArticle(slug: string, locale: string): PublishedArticle | null {
	const r = db.prepare(`${PUBLISHED_SELECT} WHERE a.slug = ? AND t.locale = ? AND t.published_body IS NOT NULL`).get(slug, locale) as PublishedRow | undefined;
	return r ? fromPublished(r) : null;
}

/** What a list or card needs: no body and no blocks (the front page would otherwise ship every article in full). */
export type PublishedSummary = Omit<PublishedArticle, 'body' | 'blocks'> & { minutes: number };
export const summarise = ({ body, blocks: _k, ...s }: PublishedArticle): PublishedSummary => ({ ...s, minutes: readingMinutes(body) });

export function listPublished(filter: { locale: string; caliber?: Caliber; tag?: string; q?: string; limit?: number }): PublishedArticle[] {
	const where = ['t.locale = ?', 't.published_body IS NOT NULL'];
	const params: unknown[] = [filter.locale];
	if (filter.caliber) (where.push('a.caliber = ?'), params.push(filter.caliber));
	// instr, not LIKE: a tag containing % or _ must not act as a wildcard.
	if (filter.tag?.trim()) (where.push("instr(',' || replace(lower(coalesce(a.tags, '')), ' ', '') || ',', ?) > 0"), params.push(`,${filter.tag.trim().toLowerCase().replace(/\s+/g, '')},`));
	if (filter.q?.trim()) {
		// One sanitised group per word, joined with an explicit AND (as in media.ts: FTS5 rejects a bare group after a term).
		const locale = filter.locale === 'en' ? 'en' : 'pl';
		const q = filter.q
			.split(/\s+/)
			.map((w) => prepareFtsQuery(w, locale, 'and'))
			.filter(Boolean)
			.join(' AND ');
		if (!q) return [];
		where.push('t.id IN (SELECT rowid FROM fts_journal WHERE fts_journal MATCH ?)');
		params.push(q);
	}
	const sql = `${PUBLISHED_SELECT} WHERE ${where.join(' AND ')} ORDER BY t.published_at DESC, a.id DESC LIMIT ?`;
	return (db.prepare(sql).all(...params, filter.limit ?? 50) as PublishedRow[]).map(fromPublished);
}

// ---- editors' overview --------------------------------------------------------------------------------

export interface EditorRow extends Article {
	locale: string;
	title: string;
	status: TextStatus;
	revision: number;
	published_revision: number | null;
	approvals: number;
	required: number;
}

/** Every article and language with its state, for the editorial back-office. */
export function listForEditors(): EditorRow[] {
	const rows = db
		.prepare(
			`SELECT a.*, t.locale, t.title, t.status, t.revision, t.published_revision,
				(SELECT COUNT(*) FROM journal_approvals p WHERE p.article_id = t.article_id AND p.locale = t.locale AND p.revision = t.revision) AS approvals
			 FROM journal_articles a JOIN journal_article_texts t ON t.article_id = a.id
			 ORDER BY a.updated_at DESC, a.id DESC, t.locale`
		)
		.all() as Omit<EditorRow, 'required'>[];
	return rows.map((r) => ({ ...r, approvals: countedApprovals(r.id, r.locale, r.revision), required: requiredApprovals(r.caliber) }));
}
