import { describe, expect, it } from 'vitest';
import { GOLDEN, evaluateRetrieval, goldenSourceIds, prepareEvalCorpus, type GoldenEntry } from '$lib/server/eval/harness';

// ROBOT-04 — The Golden Set Retrieval Gate (docs/17_Robots/ROBOT-04-golden-set-retrieval.md), offline half.
// Proves the golden set is intact and the harness can detect a miss, with no model download.
// Recall with the REAL multilingual embedder (>= 95%) and off-topic rejection are asserted by `pnpm eval`
// (src/lib/server/eval/quality.eval.ts). Do not weaken an assertion to make it pass.

describe('ROBOT-04 · the golden set is intact', () => {
	const positives = GOLDEN.filter((g) => g.expect.length > 0);
	const negatives = GOLDEN.filter((g) => g.expect.length === 0);

	it('holds at least 20 lines, in both languages, with at least 4 off-topic negative controls', () => {
		expect(GOLDEN.length).toBeGreaterThanOrEqual(20);
		expect(positives.some((g) => g.locale === 'pl')).toBe(true);
		expect(positives.some((g) => g.locale === 'en')).toBe(true);
		expect(negatives.length).toBeGreaterThanOrEqual(4);
	});

	it('has unique ids and every expected source exists in data/baseline.sql under the work it cites', () => {
		expect(new Set(GOLDEN.map((g) => g.id)).size).toBe(GOLDEN.length);
		const corpus = prepareEvalCorpus();
		for (const g of positives) {
			expect(g.cites?.length, `${g.id}: "cites" must name every expected source`).toBe(g.expect.length);
			expect(() => goldenSourceIds(g, corpus), g.id).not.toThrow();
		}
	});

	it('SABOTAGE FIXTURE: an expected id that now holds a different work is refused, not silently scored', () => {
		const corpus = prepareEvalCorpus();
		const moved: GoldenEntry = { id: 'sabotage-retitled', locale: 'en', query: 'q', expect: [5], cites: ['Pacem in Terris (John XXIII, 1963) §112'] };
		expect(() => goldenSourceIds(moved, corpus)).toThrow(/not "Pacem in Terris/);
		expect(() => goldenSourceIds({ ...moved, expect: [99999], cites: undefined }, corpus)).toThrow(/not in the corpus/);
	});
});

describe('ROBOT-04 · the harness can fail', () => {
	it('lexical retrieval (no model) still finds the English attack lines it should', async () => {
		const report = await evaluateRetrieval(null);
		const enEn = report.methods.lexical!.byPair.find((p) => p.pair === 'en->en')!;
		expect(enEn.recall).toBeGreaterThanOrEqual(0.6);
	});

	it('an entry that expects the wrong source is reported as a miss; an on-topic line posing as off-topic as a false positive', async () => {
		const wrong: GoldenEntry = {
			id: 'sabotage-wrong-source',
			locale: 'en',
			query: 'Neutrality means letting foreign armies march through our country',
			expect: [1]
		};
		const onTopicAsNegative: GoldenEntry = {
			id: 'sabotage-false-negative',
			locale: 'en',
			query: 'The territory of neutral Powers is inviolable',
			expect: []
		};
		const report = await evaluateRetrieval(null, [wrong, onTopicAsNegative]);
		expect(report.methods.lexical!.missed).toContain('sabotage-wrong-source');
		expect(report.negatives.falsePositives).toContain('sabotage-false-negative');
	});
});
