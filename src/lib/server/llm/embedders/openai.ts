import { l2normalize, type Embedder } from '../embedder';

/** Any OpenAI-compatible /embeddings endpoint. The dimension is learned from the first response. */
export class OpenAiEmbedder implements Embedder {
	readonly model: string;
	dim = 0;

	constructor(
		private readonly baseUrl: string,
		private readonly apiKey: string,
		model: string
	) {
		this.model = `api:${model}`;
		this.apiModel = model;
	}
	private readonly apiModel: string;

	private async embed(text: string): Promise<Float32Array> {
		const res = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/embeddings`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
			body: JSON.stringify({ model: this.apiModel, input: text }),
			signal: AbortSignal.timeout(30_000)
		});
		if (!res.ok) throw new Error(`Embeddings request failed (${res.status})`);
		const data = (await res.json()) as { data?: { embedding?: number[] }[] };
		const v = data.data?.[0]?.embedding;
		if (!v) throw new Error('Embeddings response had no vector');
		this.dim = v.length;
		return l2normalize(Float32Array.from(v));
	}

	embedQuery(text: string) {
		return this.embed(text);
	}
	embedPassage(text: string) {
		return this.embed(text);
	}
}
