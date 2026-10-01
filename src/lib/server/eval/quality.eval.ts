import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getEmbedder } from '$lib/server/llm/embedder';
import { getProvider } from '$lib/server/llm';
import { evaluateAuditor, evaluateRetrieval, formatAuditorReport, formatRetrievalReport } from './harness';

// Real-model quality run (plan §10). Defaults to the local multilingual embedder.
process.env.EMBEDDER ||= 'local';

// vitest swallows console output from workers, so the report is also written to a file.
const REPORT = 'data/eval-report.txt';
fs.mkdirSync('data', { recursive: true });
fs.rmSync(REPORT, { force: true });
function publish(text: string) {
	console.log(`\n${text}\n`);
	fs.appendFileSync(REPORT, `${text}\n\n`);
}

describe('retrieval quality (real embedder)', () => {
	it('reports recall@5 per method and language pair, and a vector-threshold suggestion', async () => {
		const embedder = await getEmbedder();
		const report = await evaluateRetrieval(embedder);
		publish(formatRetrievalReport(report));
		// The deterministic floor: English->English lexical retrieval must work with no model at all.
		expect(report.methods.lexical!.byPair.find((p) => p.pair === 'en->en')!.recall).toBeGreaterThanOrEqual(0.6);
		// ROBOT-04: with the real embedder, recall@5 stays >= 95% and every off-topic line gets "no strong source".
		if (embedder) {
			expect(report.methods.hybrid!.recallAt5, 'hybrid recall@5').toBeGreaterThanOrEqual(0.95);
			expect(report.endToEnd!.recall, 'end-to-end recall with real thresholds').toBeGreaterThanOrEqual(0.95);
			expect(report.negatives.falsePositives, 'off-topic lines that found a "source"').toEqual([]);
		}
	});
});

describe('auditor quality (real auditor model)', () => {
	it('catches planted bad cards and verifies sound controls', async () => {
		const auditor = getProvider('auditor');
		if (!auditor) {
			publish('Auditor evaluation skipped: set LLM_AUDITOR_BASE_URL / _API_KEY / _MODEL.');
			return;
		}
		const report = await evaluateAuditor(auditor);
		publish(formatAuditorReport(report));
		// Fabricated quotes and misattributions are stopped by code, whatever the model does.
		expect(report.deterministicCatchRate).toBe(1);
		// ROBOT-03: the model-dependent traps must be caught too, and the sound controls verified.
		expect(report.llmCatchRate, 'model-dependent traps caught').toBe(1);
		expect(report.controlPassRate, 'sound controls verified').toBe(1);
	});
});
