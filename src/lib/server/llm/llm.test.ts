import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleProvider, deriveFamily } from './openai-compatible';
import { extractJson } from './provider';
import { getProvider } from './index';
import { getEmbedder } from './embedder';
import { HashEmbedder } from './embedders/hash';

const cfg = { baseUrl: 'https://api.example.com/v1/', apiKey: 'sk-secret', model: 'gpt-test' };

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
	const fn = vi.fn(async (url: string | URL, init?: RequestInit) => handler(String(url), init ?? {}));
	vi.stubGlobal('fetch', fn);
	return fn;
}
const chat = (content: string) =>
	new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe('OpenAI-compatible provider', () => {
	it('identifies itself by host and model, and derives a family', () => {
		const p = new OpenAiCompatibleProvider(cfg);
		expect(p.id).toBe('api.example.com:gpt-test');
		expect(p.family).toBe('openai');
		expect(deriveFamily('gemini-x', '')).toBe('google');
		expect(deriveFamily('claude-x', '')).toBe('anthropic');
		expect(deriveFamily('deepseek-chat', '')).toBe('deepseek');
		expect(new OpenAiCompatibleProvider({ ...cfg, family: 'custom' }).family).toBe('custom');
	});

	it('sends system + messages with bearer auth and returns the content', async () => {
		const f = mockFetch(() => chat('hello'));
		const out = await new OpenAiCompatibleProvider(cfg).complete({ system: 'sys', messages: [{ role: 'user', content: 'hi' }] });
		expect(out).toBe('hello');
		const [url, init] = f.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://api.example.com/v1/chat/completions');
		expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-secret');
		const body = JSON.parse(init.body as string);
		expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
		expect(body.stream).toBe(false);
	});

	it('requests JSON mode for structured output and validates, retrying once with the error', async () => {
		let n = 0;
		const f = mockFetch(() => chat(n++ === 0 ? '{"wrong": true}' : '```json\n{"ok": 1}\n```'));
		const parse = (raw: unknown) => {
			const o = raw as { ok?: number };
			if (typeof o.ok !== 'number') throw new Error('missing ok');
			return o.ok;
		};
		const v = await new OpenAiCompatibleProvider(cfg).structured({ messages: [{ role: 'user', content: 'x' }] }, parse);
		expect(v).toBe(1);
		expect(f).toHaveBeenCalledTimes(2);
		expect(JSON.parse((f.mock.calls[0][1] as RequestInit).body as string).response_format).toEqual({ type: 'json_object' });
		expect(JSON.parse((f.mock.calls[1][1] as RequestInit).body as string).messages.at(-1).content).toMatch(/missing ok/);
	});

	it('does not leak the request or key in errors', async () => {
		mockFetch(() => new Response('rate limited', { status: 429 }));
		const err = (await new OpenAiCompatibleProvider(cfg)
			.complete({ messages: [{ role: 'user', content: 'secret prompt' }] })
			.catch((e: unknown) => e)) as Error;
		expect(err.message).toMatch(/429/);
		expect(err.message).not.toMatch(/secret prompt|sk-secret/);
	});

	it('streams deltas from server-sent events', async () => {
		const sse = ['data: {"choices":[{"delta":{"content":"Hel"}}]}', 'data: {"choices":[{"delta":{"content":"lo"}}]}', 'data: [DONE]', ''].join('\n\n');
		mockFetch(() => new Response(sse, { status: 200 }));
		const parts: string[] = [];
		for await (const d of new OpenAiCompatibleProvider(cfg).stream({ messages: [{ role: 'user', content: 'x' }] })) parts.push(d);
		expect(parts.join('')).toBe('Hello');
	});
});

describe('config and helpers', () => {
	it('builds a provider only when all three variables are present', () => {
		expect(getProvider('drafter', { LLM_DRAFTER_BASE_URL: 'https://x/v1', LLM_DRAFTER_MODEL: 'm' })).toBeNull();
		const p = getProvider('auditor', { LLM_AUDITOR_BASE_URL: 'https://x/v1', LLM_AUDITOR_API_KEY: 'k', LLM_AUDITOR_MODEL: 'gemini-x' });
		expect(p?.family).toBe('google');
	});

	it('extracts JSON from fenced or chatty output', () => {
		expect(extractJson('Sure! ```json\n{"a":1}\n``` done')).toEqual({ a: 1 });
		expect(extractJson('prefix {"a":{"b":2}} suffix')).toEqual({ a: { b: 2 } });
		expect(() => extractJson('nothing here')).toThrow();
	});

	it('returns no embedder unless configured, and caches the configured one', async () => {
		expect(await getEmbedder({ EMBEDDER: 'none' })).toBeNull();
		const a = await getEmbedder({ EMBEDDER: 'hash' });
		expect(a).toBeInstanceOf(HashEmbedder);
		expect(await getEmbedder({ EMBEDDER: 'hash' })).toBe(a);
		await getEmbedder({ EMBEDDER: 'none' });
	});

	it('hash embedder is deterministic and normalised', async () => {
		const e = new HashEmbedder();
		const a = await e.embedQuery('Neutralność państwa');
		const b = await e.embedQuery('neutralnosc panstwa');
		expect(Array.from(a)).toEqual(Array.from(b));
		expect(Math.hypot(...a)).toBeCloseTo(1, 5);
	});
});
