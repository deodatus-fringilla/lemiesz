import { db } from '$lib/server/db';

/**
 * Citations in journal articles use the platform's tokens: `[[src:ID]]` (a reference) and `[[quote:ID]]` (the verbatim
 * stored text). Nothing may be approved while a token points at a source that does not exist or has no human-approved
 * text: a quotation in a published article must come from the database, never from a writer's or a model's memory.
 */
const TOKEN = /\[\[(src|quote):(\d+)\]\]/g;

export interface CitationProblem {
	token: string;
	reason: 'unknown_source' | 'not_approved' | 'no_approved_text_in_locale';
}

export function citationIds(body: string): { kind: 'src' | 'quote'; id: number; token: string }[] {
	return [...body.matchAll(TOKEN)].map((m) => ({ kind: m[1] as 'src' | 'quote', id: Number(m[2]), token: m[0] }));
}

/** Every token that would not resolve to approved stored text. `quote` must exist in the article's own locale. */
export function findCitationProblems(body: string, locale: string): CitationProblem[] {
	const problems: CitationProblem[] = [];
	const seen = new Set<string>();
	for (const c of citationIds(body)) {
		if (seen.has(c.token)) continue;
		seen.add(c.token);
		if (!db.prepare('SELECT 1 FROM sources WHERE id = ?').get(c.id)) {
			problems.push({ token: c.token, reason: 'unknown_source' });
			continue;
		}
		const approved = c.kind === 'quote'
			? db.prepare("SELECT 1 FROM source_texts WHERE source_id = ? AND locale = ? AND review = 'human_approved'").get(c.id, locale)
			: db.prepare("SELECT 1 FROM source_texts WHERE source_id = ? AND review = 'human_approved'").get(c.id);
		if (!approved) problems.push({ token: c.token, reason: c.kind === 'quote' ? 'no_approved_text_in_locale' : 'not_approved' });
	}
	return problems;
}

export interface CitationInfo {
	token: string;
	kind: 'src' | 'quote';
	id: number;
	/** "Work — section" when the source exists. */
	label: string | null;
	problem: CitationProblem['reason'] | null;
}

/** Each distinct token with a readable label and its problem (if any), for the editor's citation panel. */
export function describeCitations(body: string, locale: string): CitationInfo[] {
	const problems = new Map(findCitationProblems(body, locale).map((p) => [p.token, p.reason]));
	const seen = new Set<string>();
	return citationIds(body).flatMap((c) => {
		if (seen.has(c.token)) return [];
		seen.add(c.token);
		const s = db.prepare('SELECT work, section_ref FROM sources WHERE id = ?').get(c.id) as { work: string; section_ref: string } | undefined;
		return [{ ...c, label: s ? `${s.work} — ${s.section_ref}` : null, problem: problems.get(c.token) ?? null }];
	});
}

export interface CitableSource {
	id: number;
	work: string;
	section_ref: string;
	/** Languages with human-approved text: [[quote:ID]] needs the article's language here. */
	locales: string[];
}

/** Sources that can be cited at all (at least one human-approved text), for the editor's source picker. */
export function listCitableSources(): CitableSource[] {
	const rows = db
		.prepare(
			`SELECT s.id, s.work, s.section_ref, group_concat(t.locale) AS locales
			 FROM sources s JOIN source_texts t ON t.source_id = s.id AND t.review = 'human_approved'
			 GROUP BY s.id ORDER BY s.work, s.section_ref`
		)
		.all() as { id: number; work: string; section_ref: string; locales: string }[];
	return rows.map((r) => ({ ...r, locales: r.locales.split(',') }));
}
