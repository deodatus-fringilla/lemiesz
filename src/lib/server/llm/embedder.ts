export interface Embedder {
	readonly model: string;
	readonly dim: number;
	embedQuery(text: string): Promise<Float32Array>;
	embedPassage(text: string): Promise<Float32Array>;
}
