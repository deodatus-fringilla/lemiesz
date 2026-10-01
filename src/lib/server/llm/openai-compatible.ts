import { LlmError, structuredViaComplete, type ChatRequest, type LlmProvider } from './provider';

export interface OpenAiCompatibleConfig {
	baseUrl: string;
	apiKey: string;
	model: string;
	family?: string;
	timeoutMs?: number;
}

export function deriveFamily(model: string, baseUrl: string): string {
	const m = model.toLowerCase();
	if (/^(gpt|o\d|chatgpt)/.test(m)) return 'openai';
	if (m.startsWith('gemini') || m.startsWith('gemma')) return 'google';
	if (m.startsWith('claude')) return 'anthropic';
	if (m.startsWith('deepseek')) return 'deepseek';
	if (m.startsWith('llama') || m.startsWith('meta-')) return 'meta';
	if (m.startsWith('mistral') || m.startsWith('mixtral')) return 'mistral';
	if (m.startsWith('qwen')) return 'qwen';
	try {
		return new URL(baseUrl).hostname;
	} catch {
		return model;
	}
}

/**
 * One implementation covers every OpenAI-compatible endpoint (OpenAI, Gemini's compatibility API,
 * DeepSeek, Groq, local servers…). Plain fetch: no vendor SDK.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
	readonly id: string;
	readonly family: string;
	private readonly url: string;

	constructor(private readonly cfg: OpenAiCompatibleConfig) {
		this.url = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;
		let host = cfg.baseUrl;
		try {
			host = new URL(cfg.baseUrl).hostname;
		} catch {
			/* keep raw */
		}
		this.id = `${host}:${cfg.model}`;
		this.family = cfg.family || deriveFamily(cfg.model, cfg.baseUrl);
	}

	private body(req: ChatRequest, stream: boolean, json = false) {
		const messages = [
			...(req.system ? [{ role: 'system', content: req.system }] : []),
			...req.messages
		];
		return JSON.stringify({
			model: this.cfg.model,
			messages,
			stream,
			temperature: req.temperature ?? 0.2,
			...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
			...(json ? { response_format: { type: 'json_object' } } : {})
		});
	}

	private async post(body: string): Promise<Response> {
		const res = await fetch(this.url, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
			body,
			signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 90_000)
		});
		if (!res.ok) {
			// Never echo the request (may contain private prompts); the status and a short reply are enough.
			const detail = (await res.text().catch(() => '')).slice(0, 300);
			throw new LlmError(`LLM request failed (${res.status}): ${detail}`);
		}
		return res;
	}

	async complete(req: ChatRequest, json = false): Promise<string> {
		const res = await this.post(this.body(req, false, json));
		const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
		const text = data.choices?.[0]?.message?.content;
		if (typeof text !== 'string') throw new LlmError('LLM response had no content');
		return text;
	}

	async *stream(req: ChatRequest): AsyncIterable<string> {
		const res = await this.post(this.body(req, true));
		if (!res.body) throw new LlmError('LLM stream had no body');
		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let nl: number;
			while ((nl = buffer.indexOf('\n')) !== -1) {
				const line = buffer.slice(0, nl).trim();
				buffer = buffer.slice(nl + 1);
				if (!line.startsWith('data:')) continue;
				const payload = line.slice(5).trim();
				if (payload === '[DONE]') return;
				try {
					const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
					if (typeof delta === 'string' && delta) yield delta;
				} catch {
					// ignore keep-alive / malformed chunks
				}
			}
		}
	}

	structured<T>(req: ChatRequest, parse: (raw: unknown) => T): Promise<T> {
		return structuredViaComplete({ complete: (r) => this.complete(r, true) }, req, parse);
	}
}
