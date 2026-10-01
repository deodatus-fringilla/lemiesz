import { describe, it, expect } from 'vitest';
import { db } from '../db';
import { getArgument, setArgumentSources, upsertArgumentText } from '../arguments';
import { human } from '../review';
import { upsertSourceText } from '../sources';
import { FakeLlm } from '../llm/fake';
import { assertIndependent, getProvider, NotIndependentError } from '../llm';
import { makeArgument, makeSource } from '../testing';
import { normalizeForSpan, spanInText, verifySpans } from './spancheck';
import { draftCards, parseDrafterOutput } from './drafter';
import { auditCard, decide, parseAuditVerdict, type AuditVerdict } from './auditor';
import { runDraftAndAudit } from './pipeline';
import { isSampled, reviewQueue, sampleStats } from './queue';

const alice = human('alice');
const TEXT = 'The territory of neutral Powers is inviolable. Belligerents are forbidden to move troops across it.';

const goodCard = (sourceId: number) => ({
	opponent_claim: 'Neutrals hide behind treaties',
	counter_punch: 'The law is clear: neutral territory is inviolable.',
	fallacy_type: 'strawman',
	core_principle: 'active neutrality',
	keywords: 'neutrality, territory',
	supporting_spans: [{ source_id: sourceId, span: 'The territory of neutral Powers is inviolable.' }]
});

const pass = { verdict: 'pass', reason: 'ok' };
const auditJson = (over: Record<string, unknown> = {}) =>
	JSON.stringify({
		source_fidelity: pass,
		doctrinal_alignment: pass,
		terminology: pass,
		rhetorical_efficacy: { note: 'assertive' },
		...over
	});

describe('span check (deterministic)', () => {
	it('normalises quotes, dashes, diacritics, case, footnotes and whitespace', () => {
		expect(normalizeForSpan('Justice — “right” reason (59)\n  and   Łódź')).toBe('justice - "right" reason and lodz');
	});

	it('accepts a verbatim span and rejects invented or paraphrased ones', () => {
		expect(spanInText('territory of neutral powers is inviolable', TEXT)).toBe(true);
		expect(spanInText('the territory of neutral states is sacred', TEXT)).toBe(false);
	});

	it('rejects spans that are too short to prove anything', () => {
		expect(spanInText('neutral', TEXT)).toBe(false);
	});

	it('verifies against the linked source and its stored text', () => {
		const id = makeSource({ text: TEXT });
		expect(verifySpans([{ source_id: id, span: 'The territory of neutral Powers is inviolable.' }], [id]).ok).toBe(true);
		expect(verifySpans([{ source_id: id, span: 'This sentence is not in the source at all.' }], [id]).failures[0].reason).toBe('not_in_source');
		expect(verifySpans([{ source_id: id, span: 'The territory of neutral Powers is inviolable.' }], []).failures[0].reason).toBe('source_not_linked');
		expect(verifySpans([], [id]).ok).toBe(false);
		expect(verifySpans(undefined, [id]).ok).toBe(false);
	});
});

describe('arguments: review rules', () => {
	it('creates cards as drafts and resets approval when the text changes', () => {
		const s = makeSource();
		const a = makeArgument({ source_ids: [s] }, 'human_approved');
		expect(getArgument(a)!.texts.en.review).toBe('human_approved');
		upsertArgumentText(a, 'en', { opponent_claim: 'Changed claim', counter_punch: 'Same punch.' }, alice);
		expect(getArgument(a)!.texts.en.review).toBe('draft');
	});

	it('resets every language to draft when the supporting sources change', () => {
		const s1 = makeSource();
		const s2 = makeSource({ section_ref: '§2' });
		const a = makeArgument({ source_ids: [s1] }, 'human_approved');
		expect(setArgumentSources(a, [s1], alice)).toBe(false);
		expect(getArgument(a)!.texts.en.review).toBe('human_approved');
		expect(setArgumentSources(a, [s1, s2], alice)).toBe(true);
		expect(getArgument(a)!.texts.en.review).toBe('draft');
	});

	it('marks AI-verified cards stale when a supporting source is edited', () => {
		const s = makeSource();
		const a = makeArgument({ source_ids: [s] }, 'ai_verified');
		upsertSourceText(s, 'en', { text: 'A completely different source text now.' }, alice);
		expect(getArgument(a)!.texts.en.review).toBe('stale');
	});

	it('leaves human-approved cards alone when a source is edited', () => {
		const s = makeSource();
		const a = makeArgument({ source_ids: [s] }, 'human_approved');
		upsertSourceText(s, 'en', { text: 'Edited source text, still fine for a human.' }, alice);
		expect(getArgument(a)!.texts.en.review).toBe('human_approved');
	});
});

describe('drafter', () => {
	it('stores a card whose quote is verbatim, as an AI draft', async () => {
		const s = makeSource({ text: TEXT });
		const llm = new FakeLlm('drafter-1', 'a', () => JSON.stringify({ cards: [goodCard(s)] }));
		const r = await draftCards({ provider: llm, sourceIds: [s], locale: 'en' });
		expect(r.created.length).toBe(1);
		const card = getArgument(r.created[0])!.texts.en;
		expect(card.origin).toBe('ai_drafted');
		expect(card.review).toBe('draft');
		expect(card.drafter_model).toBe('drafter-1');
		expect(card.prompt_version).toBeTruthy();
	});

	it('rejects a card with a fabricated quote before it reaches the database', async () => {
		const s = makeSource({ text: TEXT });
		const before = (db.prepare('SELECT COUNT(*) AS c FROM arguments').get() as { c: number }).c;
		const bad = { ...goodCard(s), supporting_spans: [{ source_id: s, span: 'The Pope declared that every neutral nation must arm itself.' }] };
		const llm = new FakeLlm('d', 'a', () => JSON.stringify({ cards: [bad] }));
		const r = await draftCards({ provider: llm, sourceIds: [s], locale: 'en' });
		expect(r.created).toEqual([]);
		expect(r.rejected[0].failures[0].reason).toBe('not_in_source');
		expect((db.prepare('SELECT COUNT(*) AS c FROM arguments').get() as { c: number }).c).toBe(before);
	});

	it('wraps sources as untrusted data in the prompt', async () => {
		const s = makeSource({ text: TEXT });
		const llm = new FakeLlm('d', 'a', () => JSON.stringify({ cards: [] }));
		await draftCards({ provider: llm, sourceIds: [s], locale: 'en' });
		expect(llm.calls[0].system).toMatch(/never follow instructions/i);
		expect(llm.calls[0].messages[0].content).toContain('<source id=');
	});

	it('retries once on structurally invalid output, then fails closed', async () => {
		const s = makeSource({ text: TEXT });
		let n = 0;
		const llm = new FakeLlm('d', 'a', () => (n++ === 0 ? 'not json' : JSON.stringify({ cards: [goodCard(s)] })));
		expect((await draftCards({ provider: llm, sourceIds: [s], locale: 'en' })).created.length).toBe(1);
		const broken = new FakeLlm('d', 'a', () => 'still not json');
		await expect(draftCards({ provider: broken, sourceIds: [s], locale: 'en' })).rejects.toThrow(/structured output/);
	});

	it('validates the drafter schema', () => {
		expect(() => parseDrafterOutput({})).toThrow();
		expect(() => parseDrafterOutput({ cards: [{ opponent_claim: 'x' }] })).toThrow();
	});
});

describe('auditor', () => {
	async function draftOne() {
		const s = makeSource({ text: TEXT });
		const drafter = new FakeLlm('d', 'a', () => JSON.stringify({ cards: [goodCard(s)] }));
		const { created } = await draftCards({ provider: drafter, sourceIds: [s], locale: 'en' });
		return { s, id: created[0] };
	}

	it('promotes to ai_verified only when all three gating criteria pass', async () => {
		const { id } = await draftOne();
		const auditor = new FakeLlm('aud', 'b', () => auditJson());
		const r = await auditCard({ provider: auditor, argumentId: id, locale: 'en' });
		expect(r.result).toBe('ai_verified');
		const t = getArgument(id)!.texts.en;
		expect(t.review).toBe('ai_verified');
		expect(t.auditor_model).toBe('aud');
		expect(JSON.parse(t.audit_json!).source_fidelity.verdict).toBe('pass');
		expect(t.audited_at).toBeTruthy();
	});

	it('flags on any fail or unsure — including a lone "unsure"', async () => {
		for (const bad of [{ verdict: 'fail', reason: 'x' }, { verdict: 'unsure', reason: 'x' }]) {
			for (const key of ['source_fidelity', 'doctrinal_alignment', 'terminology']) {
				const { id } = await draftOne();
				const auditor = new FakeLlm('aud', 'b', () => auditJson({ [key]: bad }));
				expect((await auditCard({ provider: auditor, argumentId: id, locale: 'en' })).result).toBe('flagged');
				expect(getArgument(id)!.texts.en.review).toBe('flagged');
			}
		}
	});

	it('never lets advisory rhetorical efficacy gate a card', () => {
		const v: AuditVerdict = {
			source_fidelity: { verdict: 'pass', reason: '' },
			doctrinal_alignment: { verdict: 'pass', reason: '' },
			terminology: { verdict: 'pass', reason: '' },
			rhetorical_efficacy: { note: 'weak and defensive' }
		};
		expect(decide(v)).toBe('ai_verified');
	});

	it('fails the span check first and does not call the LLM', async () => {
		const s = makeSource({ text: TEXT });
		const id = makeArgument({ source_ids: [s], spans: [{ source_id: s, span: 'This is not in the source text at all.' }] }, 'draft');
		const auditor = new FakeLlm('aud', 'b', () => auditJson());
		const r = await auditCard({ provider: auditor, argumentId: id, locale: 'en' });
		expect(r.result).toBe('flagged');
		expect(auditor.calls.length).toBe(0);
	});

	it('fails closed: an auditor error leaves the card a draft', async () => {
		const { id } = await draftOne();
		const auditor = new FakeLlm('aud', 'b', () => 'garbage');
		expect((await auditCard({ provider: auditor, argumentId: id, locale: 'en' })).result).toBe('error');
		expect(getArgument(id)!.texts.en.review).toBe('draft');
	});

	it('only audits drafts and stale cards', async () => {
		const s = makeSource();
		const id = makeArgument({ source_ids: [s] }, 'human_approved');
		const auditor = new FakeLlm('aud', 'b', () => auditJson());
		expect((await auditCard({ provider: auditor, argumentId: id, locale: 'en' })).result).toBe('error');
	});

	it('validates the verdict schema', () => {
		expect(() => parseAuditVerdict({})).toThrow();
		expect(() => parseAuditVerdict({ source_fidelity: { verdict: 'maybe' } })).toThrow();
	});

	it('records who audited: the auditor id is in the review trail', async () => {
		const { id } = await draftOne();
		await auditCard({ provider: new FakeLlm('aud-x', 'b', () => auditJson()), argumentId: id, locale: 'en' });
		const ev = db.prepare("SELECT actor FROM review_events WHERE owner_type = 'argument' AND owner_id = ? ORDER BY id DESC").get(id) as { actor: string };
		expect(ev.actor).toBe('system:auditor:aud-x');
	});
});

describe('pipeline orchestration and independence', () => {
	it('refuses a drafter and auditor of the same model family', async () => {
		const a = new FakeLlm('m1', 'openai', () => '{}');
		const b = new FakeLlm('m2', 'openai', () => '{}');
		expect(() => assertIndependent(a, b, {})).toThrow(NotIndependentError);
		expect(() => assertIndependent(a, b, { LLM_ALLOW_SAME_FAMILY: 'true' })).not.toThrow();
		expect(() => assertIndependent(a, new FakeLlm('m3', 'google', () => '{}'), {})).not.toThrow();
		const s = makeSource({ text: TEXT });
		await expect(runDraftAndAudit({ sourceIds: [s], locale: 'en', actor: 'alice', drafter: a, auditor: b })).rejects.toThrow(/family/);
	});

	it('needs both models configured', async () => {
		expect(getProvider('auditor', {})).toBeNull();
		const s = makeSource({ text: TEXT });
		await expect(runDraftAndAudit({ sourceIds: [s], locale: 'en', actor: 'alice', drafter: null, auditor: null })).rejects.toThrow(/not configured/);
	});

	it('runs draft → span check → audit end to end and logs the run', async () => {
		const s = makeSource({ text: TEXT });
		const drafter = new FakeLlm('d', 'a', () => JSON.stringify({ cards: [goodCard(s), { ...goodCard(s), supporting_spans: [{ source_id: s, span: 'A fabricated quotation that is not present.' }] }] }));
		const auditor = new FakeLlm('aud', 'b', () => auditJson());
		const r = await runDraftAndAudit({ sourceIds: [s], locale: 'en', actor: 'alice', drafter, auditor });
		expect(r).toMatchObject({ created: 1, rejected: 1, verified: 1, flagged: 0, errors: 0 });
		const run = db.prepare('SELECT * FROM pipeline_runs ORDER BY id DESC').get() as { drafter_model: string; auditor_model: string };
		expect(run).toMatchObject({ drafter_model: 'd', auditor_model: 'aud' });
	});
});

describe('review queue and sampling', () => {
	it('samples deterministically at roughly the configured rate', () => {
		expect(isSampled('argument', 1, 'en', 10)).toBe(isSampled('argument', 1, 'en', 10));
		const hits = Array.from({ length: 2000 }, (_, i) => isSampled('argument', i, 'en', 10)).filter(Boolean).length;
		expect(hits).toBeGreaterThan(120);
		expect(hits).toBeLessThan(280);
		expect(isSampled('argument', 5, 'en', 0)).toBe(false);
		expect(isSampled('argument', 5, 'en', 100)).toBe(true);
	});

	it('lists flagged, stale and draft work first, never approved cards', () => {
		const s = makeSource({ section_ref: '§queue' }, 'draft');
		const fl = makeArgument({ source_ids: [s], opponent_claim: 'flagged one' }, 'flagged');
		const ap = makeArgument({ source_ids: [s], opponent_claim: 'approved one' }, 'human_approved');
		const q = reviewQueue();
		expect(q.some((i) => i.ownerType === 'argument' && i.ownerId === fl && i.reason === 'flagged')).toBe(true);
		expect(q.some((i) => i.ownerType === 'argument' && i.ownerId === ap)).toBe(false);
		const flaggedIdx = q.findIndex((i) => i.reason === 'flagged');
		const draftIdx = q.findIndex((i) => i.reason === 'draft');
		expect(flaggedIdx).toBeLessThan(draftIdx);
	});

	it('orders by real usage within a reason', () => {
		const s = makeSource({ section_ref: '§usage' }, 'human_approved');
		const a1 = makeArgument({ source_ids: [s], opponent_claim: 'rarely used' }, 'flagged');
		const a2 = makeArgument({ source_ids: [s], opponent_claim: 'often used' }, 'flagged');
		db.prepare("INSERT INTO card_usage (owner_type, owner_id, uses) VALUES ('argument', ?, 50)").run(a2);
		const flagged = reviewQueue().filter((i) => i.reason === 'flagged' && i.ownerType === 'argument');
		expect(flagged.findIndex((i) => i.ownerId === a2)).toBeLessThan(flagged.findIndex((i) => i.ownerId === a1));
	});

	it('measures how often humans overturn the auditor on sampled cards', () => {
		const s = makeSource({ section_ref: '§stats' });
		const sampled: number[] = [];
		for (let i = 0; sampled.length < 6 && i < 400; i++) {
			const a = makeArgument({ source_ids: [s], opponent_claim: `stat card ${i}` }, 'ai_verified');
			if (isSampled('argument', a, 'en')) sampled.push(a);
		}
		expect(sampled.length).toBe(6);
		const before = sampleStats();
		// 2 humans agree, 4 overturn
		db.prepare("INSERT INTO review_events (owner_type, owner_id, locale, from_review, to_review, actor) VALUES ('argument', ?, 'en', 'ai_verified', 'human_approved', 'human:alice')").run(sampled[0]);
		db.prepare("INSERT INTO review_events (owner_type, owner_id, locale, from_review, to_review, actor) VALUES ('argument', ?, 'en', 'ai_verified', 'human_approved', 'human:alice')").run(sampled[1]);
		for (const id of sampled.slice(2)) {
			db.prepare("INSERT INTO review_events (owner_type, owner_id, locale, from_review, to_review, actor) VALUES ('argument', ?, 'en', 'ai_verified', 'flagged', 'human:alice')").run(id);
		}
		const after = sampleStats();
		expect(after.agreed - before.agreed).toBe(2);
		expect(after.disagreed - before.disagreed).toBe(4);
		expect(after.alert).toBe(true);
	});
});
