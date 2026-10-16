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
