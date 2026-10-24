import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getSource, listSources } from '$lib/server/sources';
import { createArgument, getArgument } from '$lib/server/arguments';
import { human } from '$lib/server/review';
import {
	deleteConversation,
	getOwnedConversation,
	listConversations,
	listMessages,
	renameConversation
} from '$lib/server/shield/conversations';
import { getCorrespondenceThread, getLetter, deconstructOpponentLetter } from '$lib/server/correspondence';
import { mediaForShield } from '$lib/server/media';
import { postersForArguments } from '$lib/server/posters';
import { getEmbedder } from '$lib/server/llm/embedder';
import { DEFAULT_LOCALE, isLocale, type Locale } from '$lib/i18n/locales';
import type { ShieldEvent } from '$lib/server/shield/shield';
import type { EvidenceSource, Tier } from '$lib/server/rag/retrieve';

type EvidencePayload = Extract<ShieldEvent, { type: 'sources' }>;

export const load: PageServerLoad = ({ url, locals }) => {
	const userId = locals.user!.id;
	const id = url.searchParams.get('c');
	const initialTab = url.searchParams.get('tab');
	const conversation = id ? getOwnedConversation(id, userId) : null;
	const rawMessages = conversation ? listMessages(conversation.id) : [];
	const locale: Locale = isLocale(locals.locale) ? locals.locale : DEFAULT_LOCALE;

	// Re-open a stored conversation: the answer text plus the verbatim quotations behind its [n] markers.
	const history = rawMessages.map((m) => {
		const meta = m.sources_json ? JSON.parse(m.sources_json) : null;
		const citations = ((meta?.citations ?? []) as { n: number; sourceId: number }[])
			.map((c) => {
				const s = getSource(c.sourceId, m.locale);
				return s?.activeText
					? {
							n: c.n,
							id: s.id,
							work: s.work,
							section_ref: s.section_ref,
							text: s.activeText.text,
							locale: s.activeText.locale,
							review: s.activeText.review
						}
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
	});

	// Reconstruct the Evidence pane from the last assistant message so opening a stored conversation shows its cards & sources.
	let restoredEvidence: EvidencePayload | null = null;
	const lastAssistant = [...rawMessages].reverse().find((m) => m.role === 'assistant' && m.sources_json);
	if (conversation && lastAssistant?.sources_json) {
		try {
			const meta = JSON.parse(lastAssistant.sources_json);
			const argIds = ((meta?.argumentIds ?? []) as number[]).filter((n) => Number.isFinite(n));
			const citeSourceIds = ((meta?.citations ?? []) as { n: number; sourceId: number }[]).map((c) => c.sourceId);

			const reconstructedArgs = argIds
				.map((aid) => {
					const a = getArgument(aid, lastAssistant.locale);
					if (!a?.activeText) return null;
					return {
						id: a.id,
						fallacy_type: a.fallacy_type,
						core_principle: a.core_principle,
						opponent_claim: a.activeText.opponent_claim,
						counter_punch: a.activeText.counter_punch,
						locale: a.activeText.locale,
						origin: a.activeText.origin,
						review: a.activeText.review,
						isFallback: a.isFallback,
						machineTranslated: false,
						sources: a.source_ids
					};
				})
				.filter((a): a is NonNullable<typeof a> => a !== null);

			const allSourceIds = [...new Set([...citeSourceIds, ...reconstructedArgs.flatMap((a) => a.sources)])];
			const reconstructedSources: EvidenceSource[] = [];
			for (const sid of allSourceIds) {
				const s = getSource(sid, lastAssistant.locale);
				if (!s?.activeText) continue;
				reconstructedSources.push({
					id: s.id,
					work: s.work,
					section_ref: s.section_ref,
					url: s.url,
					license: s.license,
					cleared_to_store: !!s.cleared_to_store,
					original_locale: s.original_locale,
					locale: s.activeText.locale,
					text: s.activeText.text,
					translator: s.activeText.translator ?? null,
					isFallback: s.isFallback,
					origin: s.activeText.origin,
					review: s.activeText.review,
					machineTranslated: false
				});
			}

			const tier: Tier = (meta?.tier as Tier) ?? (reconstructedArgs.length ? 'arguments' : reconstructedSources.length ? 'sources' : 'none');
			restoredEvidence = {
				type: 'sources',
				conversationId: conversation.id,
				tier,
				queryLocale: locale,
				outputLocale: locale,
				includeDrafts: true,
				arguments: reconstructedArgs,
				sources: reconstructedSources,
				media: mediaForShield(argIds, true),
				posters: postersForArguments(argIds, true)
			};
		} catch {
			restoredEvidence = null;
		}
	}

	const korona = getCorrespondenceThread('korona');
	const sourcesList = listSources({ locale, limit: 200 }).sources.map((s) => ({
		id: s.id,
		label: `${s.work} ${s.section_ref}`
	}));

	// Handed over from the Repository reader ("Przekaż do Tarczy"): a source to argue from, or a letter to deconstruct.
	const handedSource = Number(url.searchParams.get('source')) ? getSource(Number(url.searchParams.get('source')), locale) : null;
	const handedLetter = Number(url.searchParams.get('letter')) ? getLetter(Number(url.searchParams.get('letter'))) : null;

	return {
		conversationId: conversation?.id ?? null,
		history,
		restoredEvidence,
		recent: listConversations(userId),
		korona,
		sourcesList,
		initialTab: handedLetter ? 'deconstruct' : initialTab === 'deconstruct' || initialTab === 'dossier' ? initialTab : 'chat',
		initialSource: handedSource ? { id: handedSource.id, label: `${handedSource.work} ${handedSource.section_ref}` } : null,
		initialLetterBody: handedLetter?.body ?? null
	};
};

export const actions: Actions = {
	deconstruct: async ({ request, locals }) => {
		const fd = await request.formData();
		const letterText = String(fd.get('letter_text') ?? '').trim();
		const includeDrafts = fd.get('include_drafts') === 'on';
		if (!letterText) {
			return fail(400, { deconstructError: 'Paste an opponent letter first.' });
		}
		const embedder = await getEmbedder();
		const claims = await deconstructOpponentLetter({
			text: letterText,
			locale: locals.locale,
			includeDrafts,
			embedder,
			maxClaims: 8
		});
		return {
			deconstructed: {
				letterText,
				includeDrafts,
				claims
			}
		};
	},

	extractCard: async ({ request, locals }) => {
		const fd = await request.formData();
		const opponentClaim = String(fd.get('opponent_claim') ?? '').trim();
		const counterPunch = String(fd.get('counter_punch') ?? '').trim();
		const corePrinciple = String(fd.get('core_principle') ?? '').trim() || 'Doktryna Oazy Pokoju (Dysputa Tomistyczna)';
		const sourceIds = fd
			.getAll('source_ids')
			.map((v) => Number(v))
			.filter((n) => Number.isInteger(n) && n > 0);
		if (!opponentClaim || !counterPunch) {
			return fail(400, { extractError: 'Opponent claim and counter-punch are required.' });
		}
		const argId = createArgument(
			{
				opponent_claim: opponentClaim,
				counter_punch: counterPunch,
				core_principle: corePrinciple,
				fallacy_type: String(fd.get('fallacy_type') ?? '').trim() || null,
				locale: isLocale(locals.locale) ? locals.locale : DEFAULT_LOCALE,
				source_ids: sourceIds,
				origin: 'original',
				reason: 'extracted from Korona correspondence dossier'
			},
			human(locals.user!.username)
		);
		return { extractedCardId: argId };
	},

	renameConv: async ({ request, locals }) => {
		const fd = await request.formData();
		const id = String(fd.get('conversationId') ?? '').trim();
		const title = String(fd.get('title') ?? '').trim();
		if (id && title) renameConversation(id, locals.user!.id, title);
		return { ok: true };
	},

	deleteConv: async ({ request, locals }) => {
		const fd = await request.formData();
		const id = String(fd.get('conversationId') ?? '').trim();
		if (id) deleteConversation(id, locals.user!.id);
		return { deletedConvId: id };
	}
};
