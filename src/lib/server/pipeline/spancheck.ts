import { db } from '$lib/server/db';
import type { SupportingSpan } from '$lib/server/arguments';

/** Minimum length of a supporting span; a 3-word span proves nothing. */
export const MIN_SPAN_CHARS = 20;

/**
 * Normalises text for exact-substring comparison: Unicode-normalised, punctuation variants unified,
 * footnote markers removed, diacritics and case ignored, whitespace collapsed (plan §7.1, §12.3 p).
 */
export function normalizeForSpan(s: string): string {
	return s
		.normalize('NFKC')
		.replace(/[‘’‛′`´]/g, "'")
		.replace(/[“”„‟″]/g, '"')
		.replace(/[‐‑‒–—―]/g, '-')
		.replace(/…/g, '...')
		.replace(/\s*\(\d{1,3}\)/g, '')
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/ł/gi, 'l')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

/** True when `span` occurs verbatim (after normalisation) in `text`, and is long enough to mean something. */
export function spanInText(span: string, text: string): boolean {
	const s = normalizeForSpan(span);
	if (s.length < MIN_SPAN_CHARS) return false;
	return normalizeForSpan(text).includes(s);
}

export interface SpanFailure {
	span: string;
	source_id: number;
	reason: 'too_short' | 'source_not_linked' | 'source_missing' | 'not_in_source';
}

/** All stored texts of a source, in every language (a span may quote any of them). */
function sourceTexts(sourceId: number): string[] {
	return (db.prepare('SELECT text FROM source_texts WHERE source_id = ?').all(sourceId) as { text: string }[]).map(
		(r) => r.text
	);
}

/**
 * Deterministic, non-LLM fidelity gate. Every supporting span must (1) be long enough, (2) point at a
 * source the card is linked to, and (3) occur verbatim in that source's stored text. A card with no
 * spans fails too: nothing would tie it to a canonical text.
 */
export function verifySpans(
	spans: SupportingSpan[] | undefined,
	linkedSourceIds: number[]
): { ok: boolean; failures: SpanFailure[] } {
	const failures: SpanFailure[] = [];
	if (!spans || spans.length === 0) return { ok: false, failures: [{ span: '', source_id: 0, reason: 'source_missing' }] };
	const linked = new Set(linkedSourceIds);
	for (const sp of spans) {
		if (!linked.has(sp.source_id)) {
			failures.push({ ...sp, reason: 'source_not_linked' });
			continue;
		}
		const texts = sourceTexts(sp.source_id);
		if (texts.length === 0) {
			failures.push({ ...sp, reason: 'source_missing' });
			continue;
		}
		if (normalizeForSpan(sp.span).length < MIN_SPAN_CHARS) {
			failures.push({ ...sp, reason: 'too_short' });
			continue;
		}
		if (!texts.some((t) => spanInText(sp.span, t))) failures.push({ ...sp, reason: 'not_in_source' });
	}
	return { ok: failures.length === 0, failures };
}
