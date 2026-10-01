import type { PageServerLoad } from './$types';
import { getSource } from '$lib/server/sources';
import { getOwnedConversation, listConversations, listMessages } from '$lib/server/shield/conversations';

export const load: PageServerLoad = ({ url, locals }) => {
	const userId = locals.user!.id;
	const id = url.searchParams.get('c');
	const conversation = id ? getOwnedConversation(id, userId) : null;

	// Re-open a stored conversation: the answer text plus the verbatim quotations behind its [n] markers.
	const history = conversation
		? listMessages(conversation.id).map((m) => {
				const meta = m.sources_json ? JSON.parse(m.sources_json) : null;
				const citations = ((meta?.citations ?? []) as { n: number; sourceId: number }[])
					.map((c) => {
						const s = getSource(c.sourceId, m.locale);
						return s?.activeText
							? { n: c.n, id: s.id, work: s.work, section_ref: s.section_ref, text: s.activeText.text, locale: s.activeText.locale, review: s.activeText.review }
							: null;
					})
					.filter((c) => c !== null);
				return {
					role: m.role as 'user' | 'assistant',
					text: m.content,
					citations,
					noSource: !!meta?.noSource,
					unverified: (meta?.unverifiedQuotes ?? []) as string[]
				};
			})
		: [];

	return {
		conversationId: conversation?.id ?? null,
		history,
		recent: listConversations(userId)
	};
};
