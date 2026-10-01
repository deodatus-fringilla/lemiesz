import { db } from '$lib/server/db';
import { runChecks, type Check } from './checks';
import type { Platform } from './formats';

export interface DraftSource {
	id: number;
	work: string;
	section_ref: string;
	url: string | null;
	license: string;
	locale: string;
	review: string;
	text: string;
}

export interface DraftRecord {
	id: number;
	created_by: string;
	platform: Platform;
	tone: string;
	locale: string;
	brief: string;
	body: string;
	watermark: boolean;
	status: 'draft' | 'reviewed';
	reviewed_by: string | null;
	reviewed_at: string | null;
	sources: DraftSource[];
	checks: Check[];
	/** Ids of the approved media assets the draft references (the body holds their expanded text). */
	media: number[];
	created_at: string;
	updated_at: string;
}

type Row = Omit<DraftRecord, 'watermark' | 'sources' | 'checks' | 'media'> & {
	media_json: string;
	watermark: number;
	sources_json: string;
	checks_json: string;
};

const fromRow = (r: Row): DraftRecord => {
	const { sources_json, checks_json, media_json, watermark, ...rest } = r;
	return { ...rest, watermark: !!watermark, sources: JSON.parse(sources_json), checks: JSON.parse(checks_json), media: JSON.parse(media_json ?? '[]') };
};

export class DraftError extends Error {}

export function createDraft(input: {
	createdBy: string;
	platform: Platform;
	tone: string;
	locale: string;
	brief: string;
	body: string;
	watermark: boolean;
	sources: DraftSource[];
	checks: Check[];
	media?: number[];
}): number {
	const res = db
		.prepare(
			`INSERT INTO content_drafts (created_by, platform, tone, locale, brief, body, watermark, sources_json, checks_json, media_json)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			input.createdBy,
			input.platform,
			input.tone,
			input.locale,
			input.brief,
			input.body,
			input.watermark ? 1 : 0,
			JSON.stringify(input.sources),
			JSON.stringify(input.checks),
			JSON.stringify(input.media ?? [])
		);
	return Number(res.lastInsertRowid);
}

export function getDraft(id: number): DraftRecord | null {
	const r = db.prepare('SELECT * FROM content_drafts WHERE id = ?').get(id) as Row | undefined;
	return r ? fromRow(r) : null;
}

export function listDrafts(limit = 20): Pick<DraftRecord, 'id' | 'platform' | 'locale' | 'status' | 'watermark' | 'created_by' | 'brief' | 'created_at'>[] {
	return (
		db
			.prepare('SELECT id, platform, locale, status, watermark, created_by, brief, created_at FROM content_drafts ORDER BY id DESC LIMIT ?')
			.all(limit) as (Row & { brief: string })[]
	).map((r) => ({ ...r, watermark: !!r.watermark })) as never;
}

/** The watermark is the first paragraph of the body and always starts with a warning sign. */
export function stripWatermark(body: string): string {
	return body.replace(/^⚠[^\n]*\n+/, '');
}

/**
 * Saves an edit. Any edit sends a reviewed draft back to `draft` (a human must review the final wording),
 * and the checks are re-run on the new text against the evidence stored with the draft.
 */
export function updateBody(id: number, body: string): DraftRecord {
	const d = getDraft(id);
	if (!d) throw new DraftError('Draft not found');
	const text = body.trim();
	if (!text) throw new DraftError('Body is required');
	const checks = runChecks({ platform: d.platform, body: stripWatermark(text), sourceTexts: d.sources.map((s) => s.text), referenceLabels: d.sources.map((s) => `${s.work} ${s.section_ref}`), brief: d.brief });
	db.prepare(
		`UPDATE content_drafts SET body = ?, checks_json = ?, status = 'draft', reviewed_by = NULL, reviewed_at = NULL,
			updated_at = datetime('now') WHERE id = ?`
	).run(text, JSON.stringify(checks), id);
	return getDraft(id)!;
}

/**
 * A human takes editorial responsibility for the final text. This removes the "unreviewed material"
 * watermark. With CONTENT_REQUIRE_SECOND_REVIEWER=true the reviewer must be someone other than the author.
 */
export function markReviewed(id: number, reviewer: string, requireSecond = process.env.CONTENT_REQUIRE_SECOND_REVIEWER === 'true'): DraftRecord {
	const d = getDraft(id);
	if (!d) throw new DraftError('Draft not found');
	if (requireSecond && d.created_by === reviewer) throw new DraftError('A different person must review this draft.');
	db.prepare(
		`UPDATE content_drafts SET body = ?, watermark = 0, status = 'reviewed', reviewed_by = ?, reviewed_at = datetime('now'),
			updated_at = datetime('now') WHERE id = ?`
	).run(stripWatermark(d.body), reviewer, id);
	return getDraft(id)!;
}

export function deleteDraft(id: number): boolean {
	return db.prepare('DELETE FROM content_drafts WHERE id = ?').run(id).changes > 0;
}

/** Markdown export: the text plus a header recording its status and the evidence behind it. */
export function draftToMarkdown(d: DraftRecord): string {
	const head = [
		'---',
		`platform: ${d.platform}`,
		`tone: ${d.tone}`,
		`language: ${d.locale}`,
		`status: ${d.status}`,
		`unreviewed_material: ${d.watermark}`,
		`created_by: ${d.created_by}`,
		...(d.reviewed_by ? [`reviewed_by: ${d.reviewed_by}`, `reviewed_at: ${d.reviewed_at}`] : []),
		'sources:',
		...d.sources.map((s) => `  - "${s.work} ${s.section_ref} [${s.review}]"${s.url ? ` ${s.url}` : ''}`),
		'---',
		''
	];
	return `${head.join('\n')}\n${d.body}\n`;
}
