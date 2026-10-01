import { describe, expect, it } from 'vitest';
import { FakeLlm } from '../llm/fake';
import { HashEmbedder } from '../llm/embedders/hash';
import { evaluateAuditor, evaluateRetrieval, formatAuditorReport, formatRetrievalReport, GOLDEN } from './harness';

describe('golden set', () => {
	it('is well-formed: unique ids, both languages, negatives present', () => {
		expect(new Set(GOLDEN.map((g) => g.id)).size).toBe(GOLDEN.length);
		expect(GOLDEN.some((g) => g.locale === 'pl' && g.expect.length)).toBe(true);
		expect(GOLDEN.some((g) => g.locale === 'en' && g.expect.length)).toBe(true);
		expect(GOLDEN.some((g) => g.expect.length === 0)).toBe(true);
	});
});

// The real quality run (multilingual embeddings, real auditor) is `pnpm eval`. These tests check the
// harness itself, using the offline hash embedder and a scripted auditor.
describe('harness plumbing', () => {
	it('reports lexical recall for English attacks and correct silence for off-topic queries', async () => {
		const report = await evaluateRetrieval(null);
		expect(report.methods.lexical).toBeDefined();
		const en = report.methods.lexical!.byPair.find((p) => p.pair === 'en->en');
		expect(en).toBeDefined();
		expect(en!.recall).toBeGreaterThanOrEqual(0.6);
		expect(report.negatives.correctlyEmpty).toBe(report.negatives.total);
		expect(formatRetrievalReport(report)).toMatch(/recall@5/);
	});

	it('shows why Polish attacks need multilingual vectors: lexical alone cannot reach English sources', async () => {
		const report = await evaluateRetrieval(null);
		const pl = report.methods.lexical!.byPair.find((p) => p.pair === 'pl->en');
		expect(pl?.recall ?? 0).toBeLessThan(0.5);
	});

	it('runs all three methods when an embedder is present', async () => {
		const report = await evaluateRetrieval(new HashEmbedder());
		expect(Object.keys(report.methods).sort()).toEqual(['hybrid', 'lexical', 'vector']);
	});

	it('measures the auditor: the span check alone catches every fabricated quote and misattribution', async () => {
		// An auditor that approves everything: any bad card it lets through would be its own fault, but
		// the deterministic span check must still stop the two cards with bad quotes.
		const approveAll = new FakeLlm('lenient', 'x', () =>
			JSON.stringify({
				source_fidelity: { verdict: 'pass', reason: '' },
				doctrinal_alignment: { verdict: 'pass', reason: '' },
				terminology: { verdict: 'pass', reason: '' },
				rhetorical_efficacy: { note: '' }
			})
		);
		const report = await evaluateAuditor(approveAll);
		expect(report.deterministicCatchRate).toBe(1);
		expect(report.llmCatchRate).toBeLessThan(1); // a lenient auditor misses off-doctrine cards: the metric exposes it
		expect(report.controlPassRate).toBe(1);
		expect(formatAuditorReport(report)).toMatch(/catch rate/);
	});

	it('rewards a discerning auditor', async () => {
		const discerning = new FakeLlm('strict', 'x', (req) => {
			const card = req.messages[0].content;
			const bad = /join a military alliance|every war is forbidden/.test(card);
			const verdict = bad ? 'fail' : 'pass';
			return JSON.stringify({
				source_fidelity: { verdict: bad ? 'fail' : 'pass', reason: '' },
				doctrinal_alignment: { verdict, reason: '' },
				terminology: { verdict: 'pass', reason: '' },
				rhetorical_efficacy: { note: '' }
			});
		});
		const report = await evaluateAuditor(discerning);
		expect(report.llmCatchRate).toBe(1);
		expect(report.controlPassRate).toBe(1);
	});
});
