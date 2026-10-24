import { db } from '$lib/server/db';
import { DEFAULT_LOCALE, isLocale, type Locale } from '$lib/i18n/locales';
import type { Embedder } from '$lib/server/llm/embedder';
import { retrieve, type EvidenceArgument, type EvidenceSource, type Tier } from '$lib/server/rag/retrieve';

export const CLASSICAL_METHODOLOGIES = [
	'thomistic_disputation',
	'chivalrous_polemics',
	'classical_refutation',
	'sovereign_disputation',
	'fair_minded_refutation'
] as const;

export type ClassicalMethodology = (typeof CLASSICAL_METHODOLOGIES)[number];

export interface CorrespondenceThread {
	id: number;
	slug: string;
	title: string;
	interlocutor: string;
	organization: string;
	methodology: ClassicalMethodology;
	created_at: string;
	updated_at: string;
}

export interface CorrespondenceLetter {
	id: number;
	thread_id: number;
	turn_number: number;
	direction: 'outbound' | 'inbound';
	sender: string;
	recipient: string;
	date_label: string;
	filename: string;
	summary_pl: string;
	summary_en: string;
	body: string;
	key_claims: string[];
	created_at: string;
}

type LetterRow = Omit<CorrespondenceLetter, 'key_claims'> & { key_claims_json: string };

const fromLetterRow = (r: LetterRow): CorrespondenceLetter => {
	const { key_claims_json, ...rest } = r;
	return { ...rest, key_claims: JSON.parse(key_claims_json || '[]') };
};

export function listCorrespondenceThreads(): (CorrespondenceThread & { letterCount: number })[] {
	return db
		.prepare(
			`SELECT t.*, (SELECT COUNT(*) FROM correspondence_letters l WHERE l.thread_id = t.id) AS letterCount
			 FROM correspondence_threads t ORDER BY t.id DESC`
		)
		.all() as (CorrespondenceThread & { letterCount: number })[];
}

export function getCorrespondenceThread(slug = 'korona'): {
	thread: CorrespondenceThread | null;
	letters: CorrespondenceLetter[];
} {
	const thread = (db.prepare('SELECT * FROM correspondence_threads WHERE slug = ?').get(slug) as CorrespondenceThread | undefined) ?? null;
	if (!thread) return { thread: null, letters: [] };
	const rows = db
		.prepare('SELECT * FROM correspondence_letters WHERE thread_id = ? ORDER BY turn_number ASC, id ASC')
		.all(thread.id) as LetterRow[];
	return { thread, letters: rows.map(fromLetterRow) };
}

export function getLetter(id: number): (CorrespondenceLetter & { thread_slug: string; thread_title: string }) | null {
	const row = db
		.prepare(
			`SELECT l.*, t.slug AS thread_slug, t.title AS thread_title
			 FROM correspondence_letters l JOIN correspondence_threads t ON t.id = l.thread_id WHERE l.id = ?`
		)
		.get(id) as (LetterRow & { thread_slug: string; thread_title: string }) | undefined;
	return row ? { ...fromLetterRow(row), thread_slug: row.thread_slug, thread_title: row.thread_title } : null;
}

/** Letters across threads, newest thread first and in turn order, optionally narrowed to one thread or a phrase. */
export function listLetters(options: { threadId?: number; search?: string } = {}): (CorrespondenceLetter & { thread_slug: string })[] {
	const where: string[] = [];
	const params: (string | number)[] = [];
	if (options.threadId) {
		where.push('l.thread_id = ?');
		params.push(options.threadId);
	}
	if (options.search?.trim()) {
		where.push('(l.body LIKE ? OR l.summary_pl LIKE ? OR l.summary_en LIKE ? OR l.sender LIKE ?)');
		const like = `%${options.search.trim()}%`;
		params.push(like, like, like, like);
	}
	const rows = db
		.prepare(
			`SELECT l.*, t.slug AS thread_slug FROM correspondence_letters l JOIN correspondence_threads t ON t.id = l.thread_id
			 ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.id DESC, l.turn_number ASC, l.id ASC`
		)
		.all(...params) as (LetterRow & { thread_slug: string })[];
	return rows.map((r) => ({ ...fromLetterRow(r), thread_slug: r.thread_slug }));
}

export interface LetterInput {
	thread_id: number;
	turn_number: number;
	direction: 'outbound' | 'inbound';
	sender: string;
	recipient: string;
	date_label: string;
	filename: string;
	summary_pl: string;
	summary_en: string;
	body: string;
}

/** Field rules for a letter entered in the app; returns the problems (empty = valid). */
export function validateLetter(input: Partial<LetterInput>, ownId?: number): string[] {
	const errors: string[] = [];
	const blank = (v: unknown) => typeof v !== 'string' || v.trim().length === 0;
	if (!input.thread_id || !db.prepare('SELECT 1 FROM correspondence_threads WHERE id = ?').get(input.thread_id)) {
		errors.push('Choose an existing thread');
	}
	if (!Number.isInteger(input.turn_number) || (input.turn_number ?? 0) < 1) errors.push('Turn must be a whole number from 1');
	if (input.direction !== 'outbound' && input.direction !== 'inbound') errors.push('Direction must be outbound or inbound');
	for (const [k, label] of [
		['sender', 'Sender'],
		['recipient', 'Recipient'],
		['date_label', 'Date'],
		['summary_pl', 'Polish summary'],
		['summary_en', 'English summary'],
		['body', 'Letter text']
	] as const) {
		if (blank(input[k])) errors.push(`${label} is required`);
	}
	if (blank(input.filename) || !/^[\w.-]+$/.test(input.filename!.trim())) {
		errors.push('File name is required: letters, digits, "_", "-" and "." only');
	} else {
		const taken = db.prepare('SELECT id FROM correspondence_letters WHERE filename = ?').get(input.filename!.trim()) as { id: number } | undefined;
		if (taken && taken.id !== ownId) errors.push(`File name "${input.filename!.trim()}" is already used by another letter`);
	}
	return errors;
}

function letterValues(input: LetterInput) {
	const body = input.body.replace(/\r\n/g, '\n').trim();
	return [
		input.thread_id,
		input.turn_number,
		input.direction,
		input.sender.trim(),
		input.recipient.trim(),
		input.date_label.trim(),
		input.filename.trim(),
		input.summary_pl.trim(),
		input.summary_en.trim(),
		body,
		JSON.stringify(extractClaimsFromLetter(body, 5))
	];
}

/** Adds a letter (key claims are extracted from the text). Throws with the validation problems. */
export function createLetter(input: LetterInput): number {
	const errors = validateLetter(input);
	if (errors.length) throw new Error(errors.join('; '));
	const res = db
		.prepare(
			`INSERT INTO correspondence_letters (thread_id, turn_number, direction, sender, recipient, date_label, filename,
				summary_pl, summary_en, body, key_claims_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(...letterValues(input));
	db.prepare("UPDATE correspondence_threads SET updated_at = datetime('now') WHERE id = ?").run(input.thread_id);
	return Number(res.lastInsertRowid);
}

export function updateLetter(id: number, input: LetterInput): void {
	if (!db.prepare('SELECT 1 FROM correspondence_letters WHERE id = ?').get(id)) throw new Error(`Letter ${id} not found`);
	const errors = validateLetter(input, id);
	if (errors.length) throw new Error(errors.join('; '));
	db.prepare(
		`UPDATE correspondence_letters SET thread_id = ?, turn_number = ?, direction = ?, sender = ?, recipient = ?, date_label = ?,
			filename = ?, summary_pl = ?, summary_en = ?, body = ?, key_claims_json = ? WHERE id = ?`
	).run(...letterValues(input), id);
	db.prepare("UPDATE correspondence_threads SET updated_at = datetime('now') WHERE id = ?").run(input.thread_id);
}

export function deleteLetter(id: number): boolean {
	return db.prepare('DELETE FROM correspondence_letters WHERE id = ?').run(id).changes > 0;
}

/** The turn a new letter in a thread most likely takes: one after the last. */
export function nextTurn(threadId: number): number {
	const r = db.prepare('SELECT MAX(turn_number) AS n FROM correspondence_letters WHERE thread_id = ?').get(threadId) as { n: number | null };
	return (r.n ?? 0) + 1;
}

/** Picks which of the 5 non-Hegelian classical methodologies best fits an opponent claim. */
export function classifyMethodology(claim: string): ClassicalMethodology {
	const lower = claim.toLowerCase();
	if (/spart|demografi|koszt|gospodar|kredyt|budżet|budget|econom|10\s*000|20\s*000|proporcj/.test(lower)) {
		return 'sovereign_disputation';
	}
	if (/albo\b|alternatyw|nie potrzebujemy|chochoł|kopia|wzór|musimy wybierać|either\b|false dichotomy/.test(lower)) {
		return 'classical_refutation';
	}
	if (/si vis pacem|wegecjusz|para bellum|1939|sanacj|austri|traktat|konstytucj|kościół|katolic|hague/.test(lower)) {
		return 'thomistic_disputation';
	}
	if (/zgadzam się|wspóln|pionk|szacun|dialog|lubmin|sprzecznoś|brak sprzeczności/.test(lower)) {
		return 'chivalrous_polemics';
	}
	return 'fair_minded_refutation';
}

const NOISE_LINE = /^(szczęść boże|szanown|z wyrazami szacunku|dziękuję za|pozdrawiam|--|tel:|email:|wed |fri |mon |tue |thu |sat |sun |\d{1,2}\s+[a-ząćęłńóśźż]+\s+202\d|asystent|biuro poselskie|teresa pracownik|bogdan zięba|deodatus)/i;

/**
 * Segments a multi-paragraph opponent letter into distinct polemical claims suitable for point-by-point
 * Thomistic Disputation & Chivalrous Polemics.
 */
export function extractClaimsFromLetter(rawText: string, maxClaims = 6): string[] {
	const blocks = rawText
		.replace(/\r\n/g, '\n')
		.split(/\n\s*\n+/)
		.map((b) => b.replace(/\s+/g, ' ').trim())
		.filter(Boolean);

	const candidates: string[] = [];
	for (const b of blocks) {
		if (b.length < 55) continue;
		if (NOISE_LINE.test(b)) continue;
		// Skip purely polite openings that don't yet state a thesis
		if (/^doceniam pańskie zaangażowanie|^pragnę serdecznie podziękować/i.test(b) && b.length < 220) continue;
		candidates.push(b);
	}

	if (candidates.length <= maxClaims) return candidates;
	// Prefer paragraphs containing strong thesis markers
	const scored = candidates.map((text, idx) => {
		let score = 0;
		if (/neutraln|suwerenn|armi|wojn|pokój|pokoj|spart|sanacj|1939|austri|szwajcar|para bellum|mocarstw|obron|gospodar/i.test(text)) score += 3;
		if (/nie uważam|uważam|dlatego|jednak|alternatyw|twierdzę|różnimy się|pytanie/i.test(text)) score += 2;
		if (text.length >= 90 && text.length <= 450) score += 1;
		return { text, idx, score };
	});
	return scored
		.sort((a, b) => b.score - a.score || a.idx - b.idx)
		.slice(0, maxClaims)
		.sort((a, b) => a.idx - b.idx)
		.map((x) => x.text);
}

export interface DeconstructedClaim {
	index: number;
	claim: string;
	methodology: ClassicalMethodology;
	tier: Tier;
	arguments: (Omit<EvidenceArgument, 'sources'> & { sources: number[] })[];
	sources: EvidenceSource[];
}

export async function deconstructOpponentLetter(args: {
	text: string;
	locale?: string;
	includeDrafts?: boolean;
	embedder?: Embedder | null;
	maxClaims?: number;
}): Promise<DeconstructedClaim[]> {
	const outputLocale: Locale = isLocale(args.locale) ? args.locale : DEFAULT_LOCALE;
	const claims = extractClaimsFromLetter(args.text, args.maxClaims ?? 8);

	return Promise.all(
		claims.map(async (claim, i) => {
			const r = await retrieve({
				query: claim,
				context: 'shield',
				trust: { includeDrafts: !!args.includeDrafts },
				outputLocale,
				embedder: args.embedder ?? null,
				limit: 2,
				thresholds: { lexicalMinRatio: 0.15, lexicalMinMatched: 2 }
			});
			return {
				index: i + 1,
				claim,
				methodology: classifyMethodology(claim),
				tier: r.tier,
				arguments: r.arguments.map((a) => ({ ...a, sources: a.sources.map((s) => s.id) })),
				sources: r.sources
			};
		})
	);
}
