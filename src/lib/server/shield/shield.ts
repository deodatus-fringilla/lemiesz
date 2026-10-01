import { m } from '$lib/paraglide/messages.js';
import { DEFAULT_LOCALE, isLocale, type Locale } from '$lib/i18n/locales';
import type { Embedder } from '$lib/server/llm/embedder';
import type { LlmProvider } from '$lib/server/llm/provider';
import {
	recordUsage,
	retrieve,
	type EvidenceArgument,
	type EvidenceSource,
	type RetrieveResult,
	type Tier
} from '$lib/server/rag/retrieve';
import { CitationStreamer, findUnverifiedQuotes } from './cite';
import { appendMessage, createConversation, getOwnedConversation, listMessages } from './conversations';
import { SHIELD_PROMPT_VERSION, shieldRequest } from './prompt';

export const MAX_MESSAGE_CHARS = 2000;
const HISTORY_MESSAGES = 8;

export interface Citation {
	/** The [n] marker used in the answer text. */
	n: number;
	source: EvidenceSource;
}

type ClientArgument = Omit<EvidenceArgument, 'sources'> & { sources: number[] };

/** Typed SSE contract (plan §6.2). `sources` is always first so the pane fills before the tokens. */
export type ShieldEvent =
	| {
			type: 'sources';
			conversationId: string;
			tier: Tier;
			queryLocale: Locale;
			outputLocale: Locale;
			includeDrafts: boolean;
			arguments: ClientArgument[];
			sources: EvidenceSource[];
	  }
	| { type: 'token'; text: string }
	| {
			type: 'done';
			messageId: number;
			noSource: boolean;
			llm: boolean;
			citations: Citation[];
			/** Quoted passages in the answer that match no retrieved source. The UI must warn about them. */
			unverifiedQuotes: string[];
			watermark: boolean;
	  }
	| { type: 'error'; code: 'invalid_message' | 'conversation_not_found' | 'llm_error'; message: string };

function clientArguments(r: RetrieveResult): ClientArgument[] {
	return r.arguments.map((a) => ({ ...a, sources: a.sources.map((s) => s.id) }));
}

/**
 * One Shield turn as an async stream of events. Pure with respect to HTTP, so it is directly testable.
 *
 * Order of guarantees: retrieval is trust-filtered BEFORE the model sees anything; when nothing strong is
 * found the model is not called at all; every citation token is validated against the retrieved set; the
 * quotation shown to the user is always database text.
 */
export async function* runShield(args: {
	userId: string;
	message: string;
	conversationId?: string | null;
	outputLocale?: string;
	includeDrafts?: boolean;
	provider: LlmProvider | null;
	embedder: Embedder | null;
}): AsyncGenerator<ShieldEvent> {
	const message = args.message?.trim() ?? '';
	if (!message || message.length > MAX_MESSAGE_CHARS) {
		yield { type: 'error', code: 'invalid_message', message: `Message must be 1-${MAX_MESSAGE_CHARS} characters.` };
		return;
	}
	const outputLocale: Locale = isLocale(args.outputLocale) ? args.outputLocale : DEFAULT_LOCALE;

	let conversationId = args.conversationId ?? null;
	if (conversationId && !getOwnedConversation(conversationId, args.userId)) {
		yield { type: 'error', code: 'conversation_not_found', message: 'Conversation not found.' };
		return;
	}
	const history = conversationId
		? listMessages(conversationId)
				.filter((x): x is typeof x & { role: 'user' | 'assistant' } => x.role !== 'system')
				.slice(-HISTORY_MESSAGES)
				.map((x) => ({ role: x.role, content: x.content }))
		: [];
	conversationId ??= createConversation(args.userId, outputLocale, message);
	appendMessage(conversationId, 'user', message, outputLocale);

	const includeDrafts = !!args.includeDrafts;
	const retrieval = await retrieve({
		query: message,
		context: 'shield',
		trust: { includeDrafts },
		outputLocale,
		embedder: args.embedder,
		limit: 3
	});
	if (retrieval.tier !== 'none') recordUsage(retrieval);

	yield {
		type: 'sources',
		conversationId,
		tier: retrieval.tier,
		queryLocale: retrieval.queryLocale,
		outputLocale,
		includeDrafts,
		arguments: clientArguments(retrieval),
		sources: retrieval.sources
	};

	const finish = (answer: string, extra: { noSource: boolean; llm: boolean; citations: Citation[]; unverified: string[] }) => {
		const messageId = appendMessage(conversationId!, 'assistant', answer, outputLocale, {
			version: SHIELD_PROMPT_VERSION,
			tier: retrieval.tier,
			argumentIds: retrieval.arguments.map((a) => a.id),
			citations: extra.citations.map((c) => ({ n: c.n, sourceId: c.source.id })),
			unverifiedQuotes: extra.unverified,
			noSource: extra.noSource
		});
		return {
			type: 'done' as const,
			messageId,
			noSource: extra.noSource,
			llm: extra.llm,
			citations: extra.citations,
			unverifiedQuotes: extra.unverified,
			watermark: retrieval.watermark
		};
	};

	// Nothing strong: say so deterministically; never ask the model to improvise.
	if (retrieval.tier === 'none') {
		const text = m.shield_no_source({}, { locale: outputLocale });
		yield { type: 'token', text };
		yield finish(text, { noSource: true, llm: false, citations: [], unverified: [] });
		return;
	}

	// Retrieval-only mode: no chat model configured. The evidence panel still works.
	if (!args.provider) {
		const text = m.shield_retrieval_only({}, { locale: outputLocale });
		yield { type: 'token', text };
		yield finish(text, { noSource: false, llm: false, citations: [], unverified: [] });
		return;
	}

	const byId = new Map(retrieval.sources.map((s) => [s.id, s]));
	const cites = new CitationStreamer(new Set(byId.keys()));
	let answer = '';
	try {
		for await (const delta of args.provider.stream(shieldRequest({ outputLocale, retrieval, history, message }))) {
			const safe = cites.push(delta);
			if (safe) {
				answer += safe;
				yield { type: 'token', text: safe };
			}
		}
		const tail = cites.flush();
		if (tail) {
			answer += tail;
			yield { type: 'token', text: tail };
		}
	} catch (e) {
		console.error('[shield] model error:', (e as Error).message);
		appendMessage(conversationId, 'assistant', answer || '(model error)', outputLocale, { error: 'llm_error' });
		yield { type: 'error', code: 'llm_error', message: 'The model request failed. The evidence above is still valid.' };
		return;
	}

	const citations: Citation[] = cites.order.map((id, i) => ({ n: i + 1, source: byId.get(id)! }));
	const unverified = findUnverifiedQuotes(
		answer,
		retrieval.sources.map((s) => s.text)
	);
	yield finish(answer, { noSource: false, llm: true, citations, unverified });
}
