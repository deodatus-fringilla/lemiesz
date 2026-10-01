import { db } from '$lib/server/db';
import type { Embedder } from '$lib/server/llm/embedder';

export type OwnerType = 'source' | 'argument';

interface Entry {
	ownerType: OwnerType;
	ownerId: number;
	locale: string;
	vec: Float32Array;
}

interface Cache {
	model: string;
	entries: Entry[];
}

// Held on globalThis so Vite HMR reloads do not duplicate or lose it (plan §2). Loaded lazily.
const KEY = '__vectorCache';
type Holder = { [KEY]?: Cache | null };
const holder = globalThis as unknown as Holder;

export function invalidateVectorCache(): void {
	holder[KEY] = null;
}

function toBlob(v: Float32Array): Buffer {
	return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

function fromBlob(b: Buffer, dim: number): Float32Array {
	const copy = new Float32Array(dim);
	for (let i = 0; i < dim; i++) copy[i] = b.readFloatLE(i * 4);
	return copy;
}

function loadCache(model: string): Cache {
	const cached = holder[KEY];
	if (cached && cached.model === model) return cached;
	const rows = db
		.prepare('SELECT owner_type, owner_id, locale, dim, vector FROM embeddings WHERE model = ?')
		.all(model) as { owner_type: OwnerType; owner_id: number; locale: string; dim: number; vector: Buffer }[];
	const fresh: Cache = {
		model,
		entries: rows.map((r) => ({
			ownerType: r.owner_type,
			ownerId: r.owner_id,
			locale: r.locale,
			vec: fromBlob(r.vector, r.dim)
		}))
	};
	holder[KEY] = fresh;
	return fresh;
}

/** Drops a stored vector (used when the text it was computed from changes or is deleted). */
export function dropEmbedding(ownerType: OwnerType, ownerId: number, locale?: string): void {
	if (locale) {
		db.prepare('DELETE FROM embeddings WHERE owner_type = ? AND owner_id = ? AND locale = ?').run(ownerType, ownerId, locale);
	} else {
		db.prepare('DELETE FROM embeddings WHERE owner_type = ? AND owner_id = ?').run(ownerType, ownerId);
	}
	invalidateVectorCache();
}

/** The text a stored vector represents, per owner type. */
function passageRows(): { ownerType: OwnerType; ownerId: number; locale: string; text: string }[] {
	const sources = db
		.prepare(
			`SELECT st.source_id AS id, st.locale, s.work || ' ' || s.section_ref || char(10) || st.text AS text
			 FROM source_texts st JOIN sources s ON s.id = st.source_id`
		)
		.all() as { id: number; locale: string; text: string }[];
	const args = db
		.prepare(
			`SELECT argument_id AS id, locale, opponent_claim || char(10) || counter_punch AS text FROM argument_texts`
		)
		.all() as { id: number; locale: string; text: string }[];
	return [
		...sources.map((r) => ({ ownerType: 'source' as const, ownerId: r.id, locale: r.locale, text: r.text })),
		...args.map((r) => ({ ownerType: 'argument' as const, ownerId: r.id, locale: r.locale, text: r.text }))
	];
}

/** Embeds every text that has no vector yet for this model. Returns how many were indexed. */
export async function indexMissing(embedder: Embedder): Promise<number> {
	const have = new Set(
		(
			db.prepare('SELECT owner_type, owner_id, locale FROM embeddings WHERE model = ?').all(embedder.model) as {
				owner_type: string;
				owner_id: number;
				locale: string;
			}[]
		).map((r) => `${r.owner_type}:${r.owner_id}:${r.locale}`)
	);
	const todo = passageRows().filter((r) => !have.has(`${r.ownerType}:${r.ownerId}:${r.locale}`));
	if (todo.length === 0) return 0;

	const insert = db.prepare(
		`INSERT OR REPLACE INTO embeddings (owner_type, owner_id, locale, model, dim, vector) VALUES (?, ?, ?, ?, ?, ?)`
	);
	for (const row of todo) {
		const vec = await embedder.embedPassage(row.text);
		insert.run(row.ownerType, row.ownerId, row.locale, embedder.model, vec.length, toBlob(vec));
	}
	invalidateVectorCache();
	return todo.length;
}

/** Drops all vectors for a model and recomputes them (run after changing the embedding model or text format). */
export async function reindexAll(embedder: Embedder): Promise<number> {
	db.prepare('DELETE FROM embeddings WHERE model = ?').run(embedder.model);
	invalidateVectorCache();
	return indexMissing(embedder);
}

export interface VectorHit {
	ownerType: OwnerType;
	ownerId: number;
	locale: string;
	score: number;
}

function dot(a: Float32Array, b: Float32Array): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
}

/** Brute-force cosine search over the in-RAM cache (vectors are L2-normalised). Every locale is searched: this is the cross-lingual path. */
export function searchVectors(
	query: Float32Array,
	model: string,
	options: { ownerType?: OwnerType; limit?: number } = {}
): VectorHit[] {
	const { entries } = loadCache(model);
	const hits: VectorHit[] = [];
	for (const e of entries) {
		if (options.ownerType && e.ownerType !== options.ownerType) continue;
		if (e.vec.length !== query.length) continue;
		hits.push({ ownerType: e.ownerType, ownerId: e.ownerId, locale: e.locale, score: dot(query, e.vec) });
	}
	hits.sort((a, b) => b.score - a.score);
	return hits.slice(0, options.limit ?? 30);
}
