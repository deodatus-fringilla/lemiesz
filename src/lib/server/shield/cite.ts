import { spanInText } from '$lib/server/pipeline/spancheck';

/**
 * Citation guardrail (plan §4, §7.1): the model never writes quotations. It writes `[[src:42]]` tokens
 * (cite) or `[[quote:42]]` tokens (quote a short source); this module checks every token against the set of
 * sources that were actually retrieved, drops unknown ones, and replaces valid ones. The quotation text is
 * always the database text, never model output.
 */
const TOKEN = /\[\[\s*(src|quote)\s*:\s*(\d+)\s*\]\]/gi;
// Longest possible unfinished token we may need to hold back while streaming, e.g. "[[quote: 123456 ]"
const MAX_PENDING = 24;

export interface CitationOptions {
	/** Replacement for a citation. Default: a numbered marker "[n]" (Shield). Content uses a readable reference. */
	marker?: (sourceId: number, n: number) => string;
	/** Texts that may be quoted verbatim with `[[quote:ID]]` (e.g. only short ones). Others fall back to a plain citation. */
	quotable?: ReadonlyMap<number, string>;
	/** Wraps a verbatim quotation (default: straight double quotes). */
	quote?: (text: string, sourceId: number) => string;
}

export class CitationStreamer {
	/** Source ids in order of first valid citation; the marker number is index + 1. */
	readonly order: number[] = [];
	/** Ids the model cited that were not in the retrieved set (stripped). */
	readonly rejected: number[] = [];
	/** Ids that were expanded into a verbatim quotation. */
	readonly quoted: number[] = [];
	private buffer = '';

	constructor(
		private readonly allowed: ReadonlySet<number>,
		private readonly options: CitationOptions = {}
	) {}

	private numberFor(id: number): number {
		let i = this.order.indexOf(id);
		if (i === -1) {
			this.order.push(id);
			i = this.order.length - 1;
		}
		return i + 1;
	}

	private resolve(text: string): string {
		return text.replace(TOKEN, (_all, kind: string, raw: string) => {
			const id = Number(raw);
			if (!this.allowed.has(id)) {
				this.rejected.push(id);
				return '';
			}
			const n = this.numberFor(id);
			if (kind.toLowerCase() === 'quote') {
				const t = this.options.quotable?.get(id);
				if (t !== undefined) {
					this.quoted.push(id);
					return this.options.quote ? this.options.quote(t, id) : `"${t}"`;
				}
			}
			return this.options.marker ? this.options.marker(id, n) : `[${n}]`;
		});
	}

	/** Feed a streamed delta; returns the text that is safe to send to the client now. */
	push(delta: string): string {
		this.buffer += delta;
		// Hold back from the EARLIEST "[" (within the last MAX_PENDING chars) that is not yet closed by "]]":
		// it may still grow into a token. Using the last "[" would release the first half of "[[src:7]]".
		let safeEnd = this.buffer.length;
		const windowStart = Math.max(0, this.buffer.length - MAX_PENDING);
		for (let i = this.buffer.indexOf('[', windowStart); i !== -1; i = this.buffer.indexOf('[', i + 1)) {
			if (!this.buffer.slice(i).includes(']]')) {
				safeEnd = i;
				break;
			}
		}
		const out = this.resolve(this.buffer.slice(0, safeEnd));
		this.buffer = this.buffer.slice(safeEnd);
		return out;
	}

	/** Call once the stream ends: releases any held-back text (an unfinished token is dropped as plain text). */
	flush(): string {
		const out = this.resolve(this.buffer);
		this.buffer = '';
		return out;
	}
}

/**
 * Quoted passages in the answer that do not occur in any retrieved source. The prompt forbids quoting, so
 * a long quotation in the answer is either an invented one or a re-typed one; both are flagged for the user.
 */
export function findUnverifiedQuotes(answer: string, sourceTexts: string[], minChars = 40): string[] {
	const quotes: string[] = [];
	const patterns = [/"([^"\n]{20,})"/g, /„([^”"\n]{20,})[”"]/g, /«([^»\n]{20,})»/g, /“([^”\n]{20,})”/g];
	for (const re of patterns) for (const m of answer.matchAll(re)) quotes.push(m[1]);
	return quotes.filter((q) => q.trim().length >= minChars && !sourceTexts.some((t) => spanInText(q, t)));
}
