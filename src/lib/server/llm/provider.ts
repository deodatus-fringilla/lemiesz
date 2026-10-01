export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface ChatRequest {
	system?: string;
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
}

/**
 * The only LLM surface the app depends on (plan §5). Vendor specifics live in one implementation
 * file; nothing else imports a vendor SDK.
 */
export interface LlmProvider {
	/** Recorded on every generated / audited card, e.g. "api.openai.com:gpt-x". */
	readonly id: string;
	/** Model family, used to enforce drafter/auditor independence (plan §12.3 q). */
	readonly family: string;
	stream(req: ChatRequest): AsyncIterable<string>;
	complete(req: ChatRequest): Promise<string>;
	/** Asks for a JSON object and validates it with `parse` (which must throw on invalid input). Retries once. */
	structured<T>(req: ChatRequest, parse: (raw: unknown) => T): Promise<T>;
}

export class LlmError extends Error {}

/** Extracts the first JSON object from model output (tolerates code fences and prose around it). */
export function extractJson(text: string): unknown {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	const candidate = fenced ? fenced[1] : text;
	const start = candidate.indexOf('{');
	const end = candidate.lastIndexOf('}');
	if (start === -1 || end <= start) throw new LlmError('No JSON object in model output');
	return JSON.parse(candidate.slice(start, end + 1));
}

/** Shared structured() implementation: complete, parse, validate, retry once with the error. */
export async function structuredViaComplete<T>(
	provider: Pick<LlmProvider, 'complete'>,
	req: ChatRequest,
	parse: (raw: unknown) => T
): Promise<T> {
	let lastError: unknown;
	let messages = req.messages;
	for (let attempt = 0; attempt < 2; attempt++) {
		const text = await provider.complete({ ...req, messages });
		try {
			return parse(extractJson(text));
		} catch (e) {
			lastError = e;
			messages = [
				...req.messages,
				{ role: 'assistant', content: text },
				{
					role: 'user',
					content: `Your reply was not valid: ${(e as Error).message}. Reply again with ONLY the corrected JSON object.`
				}
			];
		}
	}
	throw new LlmError(`Model did not return valid structured output: ${(lastError as Error).message}`);
}
