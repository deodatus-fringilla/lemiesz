import { beforeAll, describe, expect, it } from 'vitest';
import { makeSource } from '$lib/server/testing';
import { normalizeForSpan, spanInText, verifySpans } from '$lib/server/pipeline/spancheck';
import { CitationStreamer, findUnverifiedQuotes } from '$lib/server/shield/cite';
import { prepareEvalCorpus } from '$lib/server/eval/harness';
import badCards from '../../eval/bad-cards.json';

// ROBOT-01 — The Verbatim Quotation Gate (docs/17_Robots/ROBOT-01-verbatim-quotation-gate.md).
// Wraps the existing guards: pipeline/spancheck.ts and shield/cite.ts. Do not weaken an assertion to make it pass.

const PIT_127 =
	'In this age which boasts of its atomic power, it no longer makes sense to maintain that war is a fit instrument with which to repair the violation of justice.';

// The seed only loads into an empty database, so build the eval corpus before any test adds rows.
let corpus: Map<string, number>;
beforeAll(() => {
	corpus = prepareEvalCorpus();
});

describe('ROBOT-01 · exact substring rule', () => {
	it('accepts a genuine span of the stored text', () => {
		expect(spanInText('it no longer makes sense to maintain that war is a fit instrument', PIT_127)).toBe(true);
	});

	it('SABOTAGE FIXTURE: a single altered word is rejected', () => {
		const altered = 'it no longer makes sense to maintain that war is a fit instrument with which to repair the violation of harmony';
		expect(spanInText(altered, PIT_127)).toBe(false);
	});

	it('rejects a paraphrase and a span that is too short to prove anything', () => {
		expect(spanInText('war is no longer a sensible tool for repairing injustice', PIT_127)).toBe(false);
		expect(spanInText('atomic power', PIT_127)).toBe(false);
	});

	it('normalises typography only (quotes, dashes, case, footnote markers), never words', () => {
		expect(normalizeForSpan('“Justice” — right reason (59)')).toBe('"justice" - right reason');
		expect(spanInText('IT NO LONGER MAKES SENSE to maintain that war', PIT_127)).toBe(true);
	});
});

describe('ROBOT-01 · cards must quote their linked source', () => {
	it('verifies a verbatim span and names the reason for each kind of failure', () => {
		const id = makeSource({ work: 'Pacem in Terris', section_ref: '§127', text: PIT_127 });
		const other = makeSource({ work: 'Elsewhere', section_ref: '§1', text: 'Nothing about atomic power or justice in this one at all.' });
		const good = 'it no longer makes sense to maintain that war is a fit instrument';
		expect(verifySpans([{ source_id: id, span: good }], [id]).ok).toBe(true);
		expect(verifySpans([{ source_id: id, span: good.replace('war', 'peace') }], [id]).failures[0].reason).toBe('not_in_source');
		expect(verifySpans([{ source_id: other, span: good }], [id]).failures[0].reason).toBe('source_not_linked');
		expect(verifySpans([{ source_id: other, span: good }], [other]).failures[0].reason).toBe('not_in_source');
		expect(verifySpans([], [id]).ok).toBe(false); // a card that quotes nothing proves nothing
	});

	it('catches the planted deterministic traps in eval/bad-cards.json without any LLM, and passes the controls', () => {
		for (const c of badCards.cards) {
			const sourceId = corpus.get(c.source);
			expect(sourceId, `${c.id}: unknown source "${c.source}"`).toBeDefined();
			const r = verifySpans(c.spans.map((span) => ({ source_id: sourceId!, span })), [sourceId!]);
			if (c.kind === 'control') expect(r.ok, `${c.id} should pass the span check`).toBe(true);
			else if (c.deterministic) expect(r.ok, `${c.id} must be caught by the span check alone`).toBe(false);
			else expect(r.ok, `${c.id} has real spans: only the LLM auditor can catch it`).toBe(true);
		}
	});
});

describe('ROBOT-01 · the Shield never lets model-typed quotations or phantom citations through', () => {
	it('strips citation tokens that are not in the retrieved set', () => {
		const s = new CitationStreamer(new Set([7]));
		const out = s.push('Neutrality is law [[src:7]] and also [[src:999]] here.') + s.flush();
		expect(out).toContain('[1]');
		expect(out).not.toContain('999');
		expect(s.rejected).toEqual([999]);
	});

	it('expands [[quote:ID]] to database text only, even when the token is split across stream chunks', () => {
		const db_text = 'The territory of neutral Powers is inviolable.';
		const s = new CitationStreamer(new Set([7]), { quotable: new Map([[7, db_text]]) });
		let out = '';
		for (const chunk of ['As the treaty says: [[quo', 'te:7', ']] -- full stop.']) out += s.push(chunk);
		out += s.flush();
		expect(out).toContain(`"${db_text}"`);
		expect(s.quoted).toEqual([7]);
	});

	it('flags a long quotation typed by the model that is not in any retrieved source', () => {
		const sources = [PIT_127];
		const invented = 'He said "Every neutral state is obliged to maintain a large standing army at all times" in 1907.';
		const genuine = 'He said "it no longer makes sense to maintain that war is a fit instrument with which to repair" once.';
		expect(findUnverifiedQuotes(invented, sources)).toHaveLength(1);
		expect(findUnverifiedQuotes(genuine, sources)).toHaveLength(0);
	});
});
