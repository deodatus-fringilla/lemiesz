export interface Embedder {
	/** Stored with every vector; retrieval only uses vectors from the active model (plan §3.2). */
	readonly model: string;
	readonly dim: number;
	embedQuery(text: string): Promise<Float32Array>;
	embedPassage(text: string): Promise<Float32Array>;
}

const KEY = '__lemieszEmbedder';
type Holder = { [KEY]?: { value: Embedder | null; env: string } };

/**
 * Returns the configured embedder (EMBEDDER=local|openai|hash|none), or null when embeddings are off.
 * Cached on globalThis so Vite HMR does not reload the model repeatedly.
 */
export async function getEmbedder(env: Record<string, string | undefined> = process.env): Promise<Embedder | null> {
	const kind = (env.EMBEDDER || 'none').toLowerCase();
	const holder = globalThis as unknown as Holder;
	if (holder[KEY]?.env === kind) return holder[KEY].value;

	let value: Embedder | null = null;
	if (kind === 'local') {
		const { LocalE5Embedder } = await import('./embedders/local');
		value = new LocalE5Embedder(env.MODEL_CACHE_DIR || './data/models');
	} else if (kind === 'openai') {
		const { OpenAiEmbedder } = await import('./embedders/openai');
		if (!env.EMBEDDER_BASE_URL || !env.EMBEDDER_API_KEY || !env.EMBEDDER_MODEL) {
			throw new Error('EMBEDDER=openai needs EMBEDDER_BASE_URL, EMBEDDER_API_KEY and EMBEDDER_MODEL');
		}
		value = new OpenAiEmbedder(env.EMBEDDER_BASE_URL, env.EMBEDDER_API_KEY, env.EMBEDDER_MODEL);
	} else if (kind === 'hash') {
		const { HashEmbedder } = await import('./embedders/hash');
		value = new HashEmbedder();
	}
	holder[KEY] = { value, env: kind };
	return value;
}

export function l2normalize(v: Float32Array): Float32Array {
	let n = 0;
	for (let i = 0; i < v.length; i++) n += v[i] * v[i];
	n = Math.sqrt(n) || 1;
	const out = new Float32Array(v.length);
	for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
	return out;
}
