import { l2normalize, type Embedder } from '../embedder';

/**
 * multilingual-e5-small running in-process (no API cost, no data leaves the machine).
 * e5 needs "query: " / "passage: " prefixes; they are hidden in here (plan §8.1).
 * The model is downloaded on first use into MODEL_CACHE_DIR (in Docker: keep it on the /data volume).
 */
export class LocalE5Embedder implements Embedder {
	readonly model = 'local:multilingual-e5-small';
	readonly dim = 384;
	private extractor: Promise<(text: string, opts: object) => Promise<{ data: Float32Array }>> | undefined;

	constructor(private readonly cacheDir: string) {}

	private load() {
		this.extractor ??= (async () => {
			const { pipeline, env } = await import('@huggingface/transformers');
			env.cacheDir = this.cacheDir;
			const p = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { dtype: 'q8' });
			return p as unknown as (text: string, opts: object) => Promise<{ data: Float32Array }>;
		})();
		return this.extractor;
	}

	private async embed(text: string): Promise<Float32Array> {
		const extractor = await this.load();
		const out = await extractor(text, { pooling: 'mean', normalize: true });
		return l2normalize(Float32Array.from(out.data));
	}

	embedQuery(text: string) {
		return this.embed(`query: ${text}`);
	}
	embedPassage(text: string) {
		return this.embed(`passage: ${text}`);
	}
}
