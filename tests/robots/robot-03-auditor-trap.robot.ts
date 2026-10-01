import { describe, expect, it } from 'vitest';
import { FakeLlm } from '$lib/server/llm/fake';
import { evaluateAuditor } from '$lib/server/eval/harness';
import badCards from '../../eval/bad-cards.json';

// ROBOT-03 — The Auditor Trap (docs/17_Robots/ROBOT-03-auditor-trap-canary.md), offline half.
// This file proves the CANARY BATTERY works (it is well formed, and it catches a rubber-stamp auditor).
// Whether the REAL auditor model catches the traps is measured by `pnpm eval` with LLM_AUDITOR_* set
// (src/lib/server/eval/quality.eval.ts). Do not weaken an assertion to make it pass.

const pass = { verdict: 'pass', reason: 'looks fine' };
const fail = { verdict: 'fail', reason: 'trap detected' };
const verdict = (c: object) =>
	JSON.stringify({ source_fidelity: c, doctrinal_alignment: c, terminology: c, rhetorical_efficacy: { note: 'n/a' } });

describe('ROBOT-03 · the battery is well formed', () => {
	const bad = badCards.cards.filter((c) => c.kind !== 'control');
	const controls = badCards.cards.filter((c) => c.kind === 'control');

	it('plants at least one trap of each class, plus sound controls', () => {
		const kinds = new Set(bad.map((c) => c.kind));
		for (const k of ['fabricated_quote', 'misattributed', 'off_doctrine', 'overreach']) expect(kinds.has(k), k).toBe(true);
		expect(controls.length).toBeGreaterThanOrEqual(2);
	});

	it('has unique ids and non-empty spans on every card', () => {
		expect(new Set(badCards.cards.map((c) => c.id)).size).toBe(badCards.cards.length);
		for (const c of badCards.cards) expect(c.spans.length, c.id).toBeGreaterThan(0);
	});
});

describe('ROBOT-03 · the canary can fail', () => {
	it('a rubber-stamp auditor (approves everything) is exposed: the model-dependent traps get through', async () => {
		const rubberStamp = new FakeLlm('rubber-stamp', 'fake', () => verdict(pass));
		const r = await evaluateAuditor(rubberStamp);
		expect(r.deterministicCatchRate).toBe(1); // code catches these regardless of the model
		expect(r.llmCatchRate).toBe(0); // ...so the gate in quality.eval.ts would fail this auditor
		expect(r.controlPassRate).toBe(1);
	});

	it('a paranoid auditor (rejects everything) is exposed too: sound controls are not verified', async () => {
		const paranoid = new FakeLlm('paranoid', 'fake', () => verdict(fail));
		const r = await evaluateAuditor(paranoid);
		expect(r.llmCatchRate).toBe(1);
		expect(r.controlPassRate).toBe(0);
	});
});
