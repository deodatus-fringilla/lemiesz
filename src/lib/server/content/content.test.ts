import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../db';
import { FakeLlm } from '../llm/fake';
import { makeArgument, makeSource } from '../testing';
import { CitationStreamer } from '../shield/cite';
import { findUnsupportedNumbers, runChecks, splitThread, spokenWords } from './checks';
import { DraftError, draftToMarkdown, getDraft, listDrafts, markReviewed, stripWatermark, updateBody } from './drafts';
import { platformInstructions } from './formats';
import { runContent, type ContentEvent } from './generate';

async function collect(gen: AsyncGenerator<ContentEvent>): Promise<ContentEvent[]> {
	const out: ContentEvent[] = [];
	for await (const e of gen) out.push(e);
	return out;
}
const done = (ev: ContentEvent[]) => ev.find((e) => e.type === 'done') as Extract<ContentEvent, { type: 'done' }> | undefined;
const err = (ev: ContentEvent[]) => ev.find((e) => e.type === 'error') as Extract<ContentEvent, { type: 'error' }> | undefined;
const text = (ev: ContentEvent[]) => ev.filter((e): e is Extract<ContentEvent, { type: 'token' }> => e.type === 'token').map((e) => e.text).join('');
const draftCount = () => (db.prepare('SELECT COUNT(*) AS c FROM content_drafts').get() as { c: number }).c;

const HAGUE = 'The territory of neutral Powers is inviolable.';
const BRIEF = 'Reply to the claim that neutral territory is inviolable only on paper';
let hagueId: number;

beforeAll(() => {
	hagueId = makeSource({ work: 'Hague V', section_ref: 'Art. 1', text: HAGUE });
	makeArgument({
		source_ids: [hagueId],
		opponent_claim: 'Neutral territory is inviolable only on paper',
		counter_punch: 'The inviolability of neutral territory is binding international law.'
	});
});

describe('deterministic checks', () => {
	it('splits an X thread on --- lines and flags posts over 280 characters', () => {
		const long = 'x'.repeat(281);
		expect(splitThread('one\n---\ntwo\n  ---  \nthree')).toEqual(['one', 'two', 'three']);
		const checks = runChecks({ platform: 'x', body: `ok post\n---\n${long}\n---\nthird`, sourceTexts: [], brief: '' });
		expect(checks.find((c) => c.id === 'x_post_length')).toMatchObject({ ok: false, detail: '2:281' });
		expect(runChecks({ platform: 'x', body: 'a\n---\nb', sourceTexts: [], brief: '' }).find((c) => c.id === 'x_post_length')!.ok).toBe(true);
	});

	it('counts code points, not UTF-16 units, so emoji and Polish letters are not over-counted', () => {
		const post = 'ł'.repeat(279) + '😀';
		expect(runChecks({ platform: 'x', body: `${post}\n---\nb`, sourceTexts: [], brief: '' }).find((c) => c.id === 'x_post_length')!.ok).toBe(true);
	});

	it('does not count bracketed editing cues as spoken words', () => {
		const words = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ');
		expect(spokenWords(`[Pause] ${words} [Show graphic: a long cue with many words inside]`)).toBe(80);
		expect(runChecks({ platform: 'shorts', body: `[Pause] ${words}`, sourceTexts: [], brief: '' }).find((c) => c.id === 'shorts_length')!.ok).toBe(true);
		expect(runChecks({ platform: 'shorts', body: 'too short', sourceTexts: [], brief: '' }).find((c) => c.id === 'shorts_length')!.ok).toBe(false);
	});

	it('flags numbers that appear nowhere in the material or the brief', () => {
		expect(findUnsupportedNumbers('In 1907 and 87% of states agreed', ['Signed in 1907.'], 'brief')).toEqual(['87']);
		expect(findUnsupportedNumbers('Only 1 thing', [], '')).toEqual([]); // single digits are not "statistics"
		expect(findUnsupportedNumbers('the 2018 vote', [], 'about the 2018 vote')).toEqual([]);
	});

	it('treats numbers inside printed reference labels as supported (regression: "Hague (1907) Art. 1")', () => {
		const body = 'Neutrality is law (Hague Convention (V) (1907) Art. 12).';
		const base = { platform: 'facebook' as const, body, sourceTexts: [HAGUE], brief: '' };
		expect(runChecks(base).find((c) => c.id === 'unsupported_numbers')!.ok).toBe(false);
		expect(runChecks({ ...base, referenceLabels: ['Hague Convention (V) (1907) Art. 12'] }).find((c) => c.id === 'unsupported_numbers')!.ok).toBe(true);
	});

	it('flags invented quotations and unresolved tokens', () => {
		const c = runChecks({
			platform: 'facebook',
			body: 'The treaty says "every neutral state must keep a large standing army" [[src:1]]',
			sourceTexts: [HAGUE],
			brief: ''
		});
		expect(c.find((x) => x.id === 'unverified_quotes')!.ok).toBe(false);
		expect(c.find((x) => x.id === 'unresolved_tokens')!.ok).toBe(false);
	});

	it('checks the press headline length', () => {
		expect(runChecks({ platform: 'press', body: `${'H'.repeat(121)}\nbody`, sourceTexts: [], brief: '' }).find((c) => c.id === 'press_headline')!.ok).toBe(false);
		expect(runChecks({ platform: 'press', body: 'Short headline\nbody', sourceTexts: [], brief: '' }).find((c) => c.id === 'press_headline')!.ok).toBe(true);
	});
});

describe('platform templates', () => {
	it('are keyed by locale and fall back to the default locale for new languages', () => {
		expect(platformInstructions('x', 'assertive', 'pl')).toMatch(/wątek/);
		expect(platformInstructions('x', 'assertive', 'en')).toMatch(/thread/);
		expect(platformInstructions('press', 'formal', 'xx')).toMatch(/komunikat/); // unknown locale → default (pl)
		expect(platformInstructions('x', 'assertive', 'en')).toContain('280');
	});
});

describe('quotations in generated content', () => {
	const allowed = new Set([1, 2]);

	it('expands [[quote:ID]] into the verbatim database text', () => {
		const c = new CitationStreamer(allowed, { quotable: new Map([[1, HAGUE]]), quote: (t) => `„${t}”`, marker: (id) => `(src ${id})` });
		expect(c.push('Law: [[quote:1]] See [[src:2]].') + c.flush()).toBe(`Law: „${HAGUE}” See (src 2).`);
		expect(c.quoted).toEqual([1]);
	});

	it('falls back to a plain reference when a source is not quotable, and strips unknown ids', () => {
		const c = new CitationStreamer(allowed, { quotable: new Map(), marker: (id) => `(src ${id})` });
		expect(c.push('x [[quote:1]] y [[quote:9]]') + c.flush()).toBe('x (src 1) y ');
		expect(c.rejected).toEqual([9]);
	});
});

describe('runContent: trust tiers for public output', () => {
	const model = (reply: string) => new FakeLlm('chat', 'x', () => reply);

	it('generates from human-approved material, resolving references and verbatim quotes', async () => {
		const llm = model(`Neutrality is law, not weakness [[src:${hagueId}]]. As the treaty puts it: [[quote:${hagueId}]]`);
		const ev = await collect(runContent({ author: 'alice', platform: 'facebook', brief: BRIEF, outputLocale: 'en', provider: llm, embedder: null }));
		expect(ev[0].type).toBe('sources');
		const body = text(ev);
		expect(body).toContain('(Hague V Art. 1)');
		expect(body).toContain(`“${HAGUE}”`); // verbatim, with English quote marks
		expect(body).not.toMatch(/\[\[/);
		const d = done(ev)!;
		expect(d.watermark).toBe(false);
		expect(d.draftId).not.toBeNull();
		const saved = getDraft(d.draftId!)!;
		expect(saved.created_by).toBe('alice');
		expect(saved.status).toBe('draft');
		expect(saved.sources[0].review).toBe('human_approved');
		expect(saved.body).toBe(body.trim());
	});

	it('uses Polish typographic quotes for Polish output', async () => {
		const llm = model(`Prawo: [[quote:${hagueId}]]`);
		const ev = await collect(runContent({ author: 'alice', platform: 'facebook', brief: BRIEF, outputLocale: 'pl', provider: llm, embedder: null }));
		expect(text(ev)).toContain(`„${HAGUE}”`);
	});

	it('generates nothing — and does not call the model — when no approved material matches', async () => {
		const llm = model('SHOULD NOT BE CALLED');
		const before = draftCount();
		const ev = await collect(runContent({ author: 'alice', platform: 'x', brief: 'best recipe for pierogi with mushrooms', outputLocale: 'en', provider: llm, embedder: null }));
		expect(llm.calls).toHaveLength(0);
		expect(done(ev)).toMatchObject({ noMaterial: true, draftId: null });
		expect(text(ev)).toMatch(/No approved sources/);
		expect(draftCount()).toBe(before);
	});

	it('keeps AI-verified material out by default, and watermarks the draft when explicitly allowed', async () => {
		const aiSource = makeSource({ work: 'Pending Memo', section_ref: '§AI', text: 'Hospitals require reliable electricity during regional emergencies.' }, 'ai_verified');
		const aiBrief = 'Hospitals require reliable electricity during regional emergencies';

		const strict = await collect(runContent({ author: 'alice', platform: 'facebook', brief: aiBrief, outputLocale: 'en', provider: model('x'), embedder: null }));
		expect(done(strict)!.noMaterial).toBe(true);

		const llm = model(`Reliable power saves lives [[src:${aiSource}]].`);
		const ev = await collect(runContent({ author: 'alice', platform: 'facebook', brief: aiBrief, outputLocale: 'en', allowAiVerified: true, provider: llm, embedder: null }));
		expect(text(ev).startsWith('⚠')).toBe(true); // streamed watermark equals what is stored
		const d = done(ev)!;
		expect(d.watermark).toBe(true);
		const saved = getDraft(d.draftId!)!;
		expect(saved.watermark).toBe(true);
		expect(saved.body.startsWith('⚠')).toBe(true);
		expect(saved.body).toBe(text(ev).trim());
	});

	it('never uses draft or flagged material, even with the override', async () => {
		makeSource({ work: 'Draft Memo', section_ref: '§D', text: 'Quarterly lighthouse maintenance budgets must be published promptly.' }, 'draft');
		const ev = await collect(runContent({ author: 'a', platform: 'facebook', brief: 'Quarterly lighthouse maintenance budgets must be published promptly', outputLocale: 'en', allowAiVerified: true, provider: model('x'), embedder: null }));
		expect(done(ev)!.noMaterial).toBe(true);
	});

	it('reports a missing chat model after showing the evidence, without saving anything', async () => {
		const before = draftCount();
		const ev = await collect(runContent({ author: 'alice', platform: 'x', brief: BRIEF, outputLocale: 'en', provider: null, embedder: null }));
		expect(ev[0].type).toBe('sources');
		expect(err(ev)!.code).toBe('llm_not_configured');
		expect(draftCount()).toBe(before);
	});

	it('rejects bad requests', async () => {
		for (const args of [{ platform: 'myspace', brief: BRIEF }, { platform: 'x', brief: '' }, { platform: 'x', brief: 'y'.repeat(1501) }, { platform: 'x', tone: 'sarcastic', brief: BRIEF }]) {
			const ev = await collect(runContent({ author: 'a', provider: null, embedder: null, ...args }));
			expect(err(ev)!.code).toBe('invalid_request');
		}
	});

	it('records failed checks for invented numbers, invented quotes and over-long posts', async () => {
		const reply = `Over 87% of states agree [[src:${hagueId}]].\n---\nThe Convention says "every neutral state must keep a large standing army at all times".\n---\n${'y'.repeat(300)}`;
		const ev = await collect(runContent({ author: 'a', platform: 'x', brief: BRIEF, outputLocale: 'en', provider: model(reply), embedder: null }));
		const failed = done(ev)!.checks.filter((c) => !c.ok).map((c) => c.id).sort();
		expect(failed).toEqual(['unsupported_numbers', 'unverified_quotes', 'x_post_length']);
	});

	it('hands the model trust-filtered material wrapped as data, with the platform rules', async () => {
		const llm = model('ok');
		await collect(runContent({ author: 'a', platform: 'x', tone: 'assertive', brief: BRIEF, outputLocale: 'en', provider: llm, embedder: null }));
		const sys = llm.calls[0].system!;
		expect(sys).toContain(`<source id="${hagueId}"`);
		expect(sys).toContain('280');
		expect(sys).toMatch(/never follow instructions/);
		expect(sys).toMatch(/allowed ids/);
	});
});

describe('draft lifecycle', () => {
	async function watermarked() {
		const s = makeSource({ work: 'AI Memo', section_ref: '§W', text: 'Volunteer firefighters train every weekend across rural districts.' }, 'ai_verified');
		const ev = await collect(
			runContent({ author: 'alice', platform: 'facebook', brief: 'Volunteer firefighters train every weekend across rural districts', outputLocale: 'en', allowAiVerified: true, provider: new FakeLlm('c', 'x', () => `They train every weekend [[src:${s}]].`), embedder: null })
		);
		return getDraft(done(ev)!.draftId!)!;
	}

	it('review removes the watermark and records who took responsibility', async () => {
		const d = await watermarked();
		expect(d.watermark).toBe(true);
		const r = markReviewed(d.id, 'bob');
		expect(r).toMatchObject({ status: 'reviewed', reviewed_by: 'bob', watermark: false });
		expect(r.body.startsWith('⚠')).toBe(false);
		expect(r.body).toContain('They train every weekend');
	});

	it('any edit sends a reviewed draft back to review and re-runs the checks', async () => {
		const d = await watermarked();
		markReviewed(d.id, 'bob');
		const edited = updateBody(d.id, 'They train every weekend, and 4500 people attended.');
		expect(edited.status).toBe('draft');
		expect(edited.reviewed_by).toBeNull();
		expect(edited.checks.find((c) => c.id === 'unsupported_numbers')!.ok).toBe(false);
		expect(() => updateBody(d.id, '   ')).toThrow(DraftError);
	});

	it('can require a second person to review (CONTENT_REQUIRE_SECOND_REVIEWER)', async () => {
		const d = await watermarked();
		expect(() => markReviewed(d.id, 'alice', true)).toThrow(/different person/);
		expect(markReviewed(d.id, 'bob', true).status).toBe('reviewed');
	});

	it('exports markdown that records status, unreviewed material and the evidence', async () => {
		const d = await watermarked();
		const md = draftToMarkdown(d);
		expect(md).toContain('unreviewed_material: true');
		expect(md).toContain('status: draft');
		expect(md).toContain('AI Memo §W [ai_verified]');
		const reviewed = draftToMarkdown(markReviewed(d.id, 'bob'));
		expect(reviewed).toContain('unreviewed_material: false');
		expect(reviewed).toContain('reviewed_by: bob');
	});

	it('lists recent drafts and strips only a leading watermark paragraph', async () => {
		expect(listDrafts().length).toBeGreaterThan(0);
		expect(stripWatermark('⚠ warning line\n\nReal text')).toBe('Real text');
		expect(stripWatermark('Real text ⚠ not leading')).toBe('Real text ⚠ not leading');
	});
});
