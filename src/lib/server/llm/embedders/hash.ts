import { l2normalize, type Embedder } from '../embedder';

/**
 * Deterministic bag-of-words / character-trigram hashing embedder. Not multilingual and not
 * semantically meaningful across languages: it exists so tests and offline development can exercise
 * the vector path without downloading a model. Never use it to judge retrieval quality.
 */
export class HashEmbedder implements Embedder {
	readonly model = 'test:hash-256';
	readonly dim = 256;

	private embed(text: string): Float32Array {
		const v = new Float32Array(this.dim);
		const norm = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
		const words = norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
		const bump = (s: string, w: number) => {
			let h = 2166136261;
			for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
			v[(h >>> 0) % this.dim] += w;
		};
		for (const w of words) {
			bump(`w:${w}`, 1);
			for (let i = 0; i + 3 <= w.length; i++) bump(`t:${w.slice(i, i + 3)}`, 0.3);
		}
		return l2normalize(v);
	}

	async embedQuery(text: string) {
		return this.embed(text);
	}
	async embedPassage(text: string) {
		return this.embed(text);
	}
}
