import { structuredViaComplete, type ChatRequest, type LlmProvider } from './provider';

/** Scripted provider for tests and offline dry-runs. `respond` receives every request and returns the raw model text. */
export class FakeLlm implements LlmProvider {
	readonly calls: ChatRequest[] = [];

	constructor(
		readonly id: string,
		readonly family: string,
		private readonly respond: (req: ChatRequest, callIndex: number) => string | Promise<string>
	) {}

	async complete(req: ChatRequest): Promise<string> {
		this.calls.push(req);
		return this.respond(req, this.calls.length - 1);
	}

	async *stream(req: ChatRequest): AsyncIterable<string> {
		const text = await this.complete(req);
		for (const word of text.split(/(?<= )/)) yield word;
	}

	structured<T>(req: ChatRequest, parse: (raw: unknown) => T): Promise<T> {
		return structuredViaComplete(this, req, parse);
	}
}
