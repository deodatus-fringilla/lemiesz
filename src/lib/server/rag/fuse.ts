/**
 * Reciprocal Rank Fusion (plan §4): score(item) = Σ weight / (k + rank). No score calibration is needed,
 * so BM25 and cosine similarity can be combined directly. `lists` are best-first rankings of item keys.
 */
export function reciprocalRankFusion(
	lists: { keys: string[]; weight?: number }[],
	k = 60
): { key: string; score: number }[] {
	const scores = new Map<string, number>();
	for (const { keys, weight = 1 } of lists) {
		keys.forEach((key, index) => {
			scores.set(key, (scores.get(key) ?? 0) + weight / (k + index + 1));
		});
	}
	return [...scores.entries()].map(([key, score]) => ({ key, score })).sort((a, b) => b.score - a.score);
}
