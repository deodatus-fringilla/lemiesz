<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Check, ExternalLink, FileText, History, Mail, MessageSquareQuote, PenLine, Search, Send, Sparkles, Trash2, TriangleAlert } from 'lucide-svelte';
	import { replaceState } from '$app/navigation';
	import { m } from '$lib/paraglide/messages.js';
	import ReviewBadge from '$lib/components/ReviewBadge.svelte';
	import { languageLabel, methodologyLabel } from '$lib/i18n/labels';
	import type { ShieldEvent } from '$lib/server/shield/shield';

	type Evidence = Extract<ShieldEvent, { type: 'sources' }>;
	type Cite = {
		n: number;
		id: number;
		work: string;
		section_ref: string;
		text: string;
		locale: string;
		review: string;
		translator: string | null;
		license: string;
	};
	type Msg = {
		role: 'user' | 'assistant';
		text: string;
		citations: Cite[];
		noSource?: boolean;
		unverified: string[];
		error?: boolean;
		watermark?: boolean;
	};

	let { data, form } = $props();

	let activeTab = $state<'chat' | 'deconstruct' | 'dossier'>('chat');
	let messages = $state<Msg[]>([]);
	let evidence = $state<Evidence | null>(null);
	let conversationId = $state<string | null>(null);
	let input = $state('');
	let busy = $state(false);
	let includeDrafts = $state(true);
	let highlighted = $state<number | null>(null);
	let copiedIndex = $state<string | null>(null);
	let deconstructText = $state('');
	let showHistory = $state(false);
	let convSearch = $state('');
	let editingConvId = $state<string | null>(null);
	let editingConvTitle = $state('');

	// Load a stored conversation or initial tab when the URL points at one.
	$effect(() => {
		conversationId = data.conversationId;
		messages = data.history.map((h) => ({ ...h, citations: h.citations as Cite[] }));
		evidence = data.restoredEvidence ?? null;
		if (data.initialTab === 'deconstruct' || data.initialTab === 'dossier') {
			activeTab = data.initialTab;
		}
		if (data.initialLetterBody) deconstructText = data.initialLetterBody;
		if (data.initialSource && !data.conversationId) input = m.shield_from_source({ work: data.initialSource.label });
	});

	// If form returned deconstructed claims, switch to deconstruct tab and keep the text.
	$effect(() => {
		if (form?.deconstructed) {
			activeTab = 'deconstruct';
			deconstructText = form.deconstructed.letterText;
		}
	});

	const presets = $derived([
		{ name: m.shield_preset_swiss_name(), text: m.shield_preset_swiss_text() },
		{ name: m.shield_preset_double_name(), text: m.shield_preset_double_text() },
		{ name: m.shield_preset_paradox_name(), text: m.shield_preset_paradox_text() },
		{ name: m.shield_preset_hedgehog_name(), text: m.shield_preset_hedgehog_text() },
		{
			name: 'Korona IV: Lemiesz a Miecz',
			text: 'Pokój, silna gospodarka i silna armia nie wykluczają się wzajemnie — Polska powinna być Oazą Pokoju, ale nie Oazą Bezbronności. Nie ma potrzeby wybierać między lemieszem a mieczem.'
		}
	]);

	const inboundLetters = $derived((data.korona?.letters ?? []).filter((l) => l.direction === 'inbound'));
	const filteredRecent = $derived(
		convSearch.trim()
			? data.recent.filter((c) => (c.title ?? c.id).toLowerCase().includes(convSearch.trim().toLowerCase()))
			: data.recent
	);

	const citedIds = $derived(new Set(messages.at(-1)?.citations.map((c) => c.id) ?? []));
	const tierLabel = $derived(
		evidence?.tier === 'arguments'
			? m.shield_tier_arguments()
			: evidence?.tier === 'sources'
				? m.shield_tier_sources()
				: m.shield_tier_none()
	);

	/** Splits answer text into plain parts and [n] citation markers. */
	function parts(text: string): { t: string; n?: number }[] {
		return text
			.split(/(\[\d+\])/)
			.filter(Boolean)
			.map((p) => {
				const mt = p.match(/^\[(\d+)\]$/);
				return mt ? { t: p, n: Number(mt[1]) } : { t: p };
			});
	}

	async function copyMsg(key: string, text: string, withFootnotes = false, citations: Cite[] = []) {
		let out = withFootnotes ? text : text.replace(/\s*\[\d+\]/g, '');
		if (withFootnotes && citations.length) {
			const notes = citations.map((c) => `[${c.n}] ${c.work} ${c.section_ref} — „${c.text.slice(0, 160)}”`).join('\n');
			out = `${out}\n\n---\n${notes}`;
		}
		await navigator.clipboard.writeText(out);
		copiedIndex = key;
		setTimeout(() => {
			if (copiedIndex === key) copiedIndex = null;
		}, 1800);
	}

	async function send(overrideMessage?: string) {
		const message = (overrideMessage ?? input).trim();
		if (!message || busy) return;
		activeTab = 'chat';
		busy = true;
		if (!overrideMessage) input = '';
		messages.push({ role: 'user', text: message, citations: [], unverified: [] });
		messages.push({ role: 'assistant', text: '', citations: [], unverified: [] });
		const answer = messages[messages.length - 1];

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ message, conversationId, includeDrafts })
			});
			if (!res.ok || !res.body) throw new Error(String(res.status));
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				let sep: number;
				while ((sep = buffer.indexOf('\n\n')) !== -1) {
					const block = buffer.slice(0, sep);
					buffer = buffer.slice(sep + 2);
					const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
					if (!dataLine) continue;
					const e = JSON.parse(dataLine.slice(5)) as ShieldEvent;
					if (e.type === 'sources') {
						evidence = e;
						conversationId = e.conversationId;
					} else if (e.type === 'token') {
						answer.text += e.text;
					} else if (e.type === 'done') {
						answer.citations = e.citations.map((c) => ({
							n: c.n,
							id: c.source.id,
							work: c.source.work,
							section_ref: c.source.section_ref,
							text: c.source.text,
							locale: c.source.locale,
							review: c.source.review,
							translator: c.source.translator,
							license: c.source.license
						}));
						answer.noSource = e.noSource;
						answer.unverified = e.unverifiedQuotes;
						answer.watermark = e.watermark;
					} else if (e.type === 'error') {
						answer.error = true;
						if (!answer.text) answer.text = m.shield_error_generic();
					}
				}
			}
		} catch {
			answer.error = true;
			answer.text ||= m.shield_error_generic();
		} finally {
			busy = false;
		}
	}

	function newConversation() {
		messages = [];
		evidence = null;
		conversationId = null;
		activeTab = 'chat';
		replaceState('/shield', {});
	}

	function loadIntoDeconstructor(body: string) {
		deconstructText = body;
		activeTab = 'deconstruct';
	}
</script>

<div class="space-y-6">
	<!-- Header & Workflow Mode Tabs -->
	<div class="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{m.shield_title()}</h1>
			<p class="mt-1 text-sm text-zinc-400">{m.shield_intro()}</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<div class="flex rounded-lg border border-zinc-800 bg-zinc-900/60 p-1 text-xs font-medium">
				<button
					type="button"
					onclick={() => (activeTab = 'chat')}
					class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors {activeTab === 'chat'
						? 'bg-amber-500 font-semibold text-zinc-950'
						: 'text-zinc-400 hover:text-zinc-100'}"
				>
					<MessageSquareQuote class="h-3.5 w-3.5" />
					{m.shield_tab_chat()}
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'deconstruct')}
					class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors {activeTab === 'deconstruct'
						? 'bg-amber-500 font-semibold text-zinc-950'
						: 'text-zinc-400 hover:text-zinc-100'}"
				>
					<Sparkles class="h-3.5 w-3.5" />
					{m.shield_tab_deconstruct()}
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'dossier')}
					class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors {activeTab === 'dossier'
						? 'bg-amber-500 font-semibold text-zinc-950'
						: 'text-zinc-400 hover:text-zinc-100'}"
				>
					<Mail class="h-3.5 w-3.5" />
					{m.shield_tab_dossier()}
				</button>
			</div>
			{#if activeTab === 'chat'}
				<button
					type="button"
					onclick={() => (showHistory = !showHistory)}
					class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors {showHistory
						? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
						: 'border-zinc-700 text-zinc-300 hover:bg-zinc-900'}"
				>
					<History class="h-3.5 w-3.5" />
					{m.shield_recent()} ({data.recent.length})
				</button>
				<button type="button" onclick={newConversation} class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-900">
					{m.shield_new()}
				</button>
			{/if}
		</div>
	</div>

	{#if activeTab === 'chat'}
		<div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
			<section class="space-y-4">
				{#if showHistory || data.recent.length}
					<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm {showHistory ? 'block' : 'hidden sm:block'}">
						<div class="flex flex-wrap items-center justify-between gap-2 pb-2">
							<button
								type="button"
								onclick={() => (showHistory = !showHistory)}
								class="inline-flex items-center gap-1.5 font-medium text-zinc-200 hover:text-amber-300"
							>
								<History class="h-4 w-4 text-amber-400" />
								{m.shield_recent()} ({filteredRecent.length}/{data.recent.length})
							</button>
							<div class="relative min-w-48 flex-1 sm:max-w-xs">
								<Search class="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
								<input
									type="search"
									bind:value={convSearch}
									placeholder={m.sources_filter_placeholder()}
									class="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-1 pl-8 pr-2.5 text-xs text-zinc-200"
								/>
							</div>
						</div>
						<ul class="mt-2 grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2">
							{#each filteredRecent as c (c.id)}
								<li class="flex items-center justify-between gap-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-2.5 py-1.5 text-xs">
									{#if editingConvId === c.id}
										<form
											method="POST"
											action="?/renameConv"
											use:enhance={() =>
												async ({ update }) => {
													await update();
													editingConvId = null;
												}}
											class="flex flex-1 items-center gap-1"
										>
											<input type="hidden" name="conversationId" value={c.id} />
											<input
												name="title"
												bind:value={editingConvTitle}
												required
												class="w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-100"
											/>
											<button class="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-zinc-950">{m.repo_save()}</button>
											<button type="button" onclick={() => (editingConvId = null)} class="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">✕</button>
										</form>
									{:else}
										<div class="min-w-0 flex-1">
											<a
												class="block truncate font-medium {data.conversationId === c.id
													? 'text-amber-300'
													: 'text-sky-400 hover:underline'}"
												href="/shield?c={c.id}"
											>
												{c.title ?? c.id}
											</a>
											<div class="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
												<span>{c.message_count ?? 0} msg</span>
												<span>·</span>
												<span>{c.updated_at.slice(0, 16).replace('T', ' ')}</span>
											</div>
										</div>
										<div class="flex shrink-0 items-center gap-1">
											<button
												type="button"
												title="Rename"
												onclick={() => {
													editingConvId = c.id;
													editingConvTitle = c.title ?? c.id;
												}}
												class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
											>
												<PenLine class="h-3 w-3" />
											</button>
											<form
												method="POST"
												action="?/deleteConv"
												use:enhance={() =>
													async ({ update }) => {
														await update();
														if (conversationId === c.id) newConversation();
													}}
											>
												<input type="hidden" name="conversationId" value={c.id} />
												<button type="submit" title={m.repo_delete()} class="rounded p-1 text-zinc-500 hover:bg-rose-500/15 hover:text-rose-300">
													<Trash2 class="h-3 w-3" />
												</button>
											</form>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<div class="flex flex-wrap items-center gap-2 text-xs">
					<span class="text-zinc-500">{m.shield_presets()}:</span>
					{#each presets as p (p.name)}
						<button type="button" onclick={() => (input = p.text)} class="rounded-full border border-zinc-700 px-3 py-1 hover:bg-zinc-900">
							{p.name}
						</button>
					{/each}
				</div>

				<div class="min-h-64 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4" aria-live="polite">
					{#each messages as msg, i (i)}
						<div class={msg.role === 'user' ? 'text-zinc-200' : 'border-t border-zinc-800/60 pt-3 first:border-t-0 first:pt-0'}>
							<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
								<span class="text-xs font-semibold uppercase tracking-wide {msg.role === 'user' ? 'text-zinc-500' : 'text-amber-400'}">
									{msg.role === 'user' ? m.shield_you() : m.shield_assistant()}
								</span>
								{#if msg.role === 'assistant' && msg.text}
									<div class="flex flex-wrap items-center gap-1.5">
										<button
											type="button"
											onclick={() => copyMsg(`${i}-plain`, msg.text, false)}
											class="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
										>
											{#if copiedIndex === `${i}-plain`}<Check class="h-3 w-3 text-emerald-400" />{m.content_copied()}{:else}<Copy class="h-3 w-3" />{m.shield_copy_reply()}{/if}
										</button>
										{#if msg.citations.length}
											<button
												type="button"
												onclick={() => copyMsg(`${i}-notes`, msg.text, true, msg.citations)}
												class="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
											>
												{#if copiedIndex === `${i}-notes`}<Check class="h-3 w-3 text-emerald-400" />{m.content_copied()}{:else}<Copy class="h-3 w-3" />+ [1..{msg.citations.length}]{/if}
											</button>
										{/if}
										<a
											href="/content?platform=letter&brief={encodeURIComponent(messages[i - 1]?.text ?? msg.text.slice(0, 300))}"
											class="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300 hover:bg-amber-500/20"
										>
											<PenLine class="h-3 w-3" />{m.shield_to_letter()}
										</a>
										<a
											href="/content?platform=x&brief={encodeURIComponent(messages[i - 1]?.text ?? msg.text.slice(0, 300))}"
											class="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
										>
											<FileText class="h-3 w-3" />{m.shield_to_x()}
										</a>
									</div>
								{/if}
							</div>
							<p class="whitespace-pre-line text-sm leading-relaxed {msg.error ? 'text-rose-300' : ''}">
								{#each parts(msg.text) as part, j (j)}
									{#if part.n}
										<button
											type="button"
											class="mx-0.5 rounded bg-amber-500/20 px-1 align-super text-[10px] font-bold text-amber-300 hover:bg-amber-500/40"
											onmouseenter={() => (highlighted = msg.citations.find((c) => c.n === part.n)?.id ?? null)}
											onmouseleave={() => (highlighted = null)}
											onclick={() =>
												document
													.getElementById(`ev-${msg.citations.find((c) => c.n === part.n)?.id}`)
													?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
										>
											{part.t}
										</button>
									{:else}{part.t}{/if}
								{/each}
								{#if busy && i === messages.length - 1 && !msg.text}<span class="text-zinc-500">{m.shield_sending()}</span>{/if}
							</p>
							{#if msg.unverified.length}
								<p role="alert" class="mt-2 flex items-start gap-2 rounded bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
									<TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />{m.shield_unverified_warning()}
								</p>
							{/if}
							{#if msg.citations.length}
								<ol class="mt-3 space-y-2 border-l-2 border-amber-500/40 pl-3 text-xs">
									{#each msg.citations as c (c.n)}
										<li>
											<span class="font-bold text-amber-300">[{c.n}]</span> <span class="font-semibold">{c.work} {c.section_ref}</span>
											<span class="text-zinc-500">({languageLabel(c.locale)})</span>
											<blockquote class="mt-0.5 text-zinc-400">„{c.text}”</blockquote>
											<div class="mt-0.5 text-zinc-500">{c.translator ? `${c.translator} · ` : ''}{m.repo_license()}: {c.license}</div>
										</li>
									{/each}
								</ol>
							{/if}
						</div>
					{:else}
						<p class="text-sm text-zinc-500">{m.shield_evidence_empty()}</p>
					{/each}
				</div>

				{#if includeDrafts}
					<p role="status" class="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
						<TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />{m.shield_drafts_warning()}
					</p>
				{/if}

				<form
					onsubmit={(e) => {
						e.preventDefault();
						send();
					}}
					class="space-y-2"
				>
					<textarea
						bind:value={input}
						rows="3"
						maxlength="2000"
						placeholder={m.shield_placeholder()}
						disabled={busy}
						onkeydown={(e) => {
							if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
								e.preventDefault();
								send();
							}
						}}
						class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
					></textarea>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<label class="flex items-center gap-2 text-xs text-zinc-400">
							<input type="checkbox" bind:checked={includeDrafts} />{m.shield_include_drafts()}
						</label>
						<button
							disabled={busy || !input.trim()}
							class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
						>
							<Send class="h-4 w-4" />{m.shield_send()}
						</button>
					</div>
				</form>
			</section>

			<aside class="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label={m.shield_evidence()}>
				<h2 class="text-lg font-semibold">{m.shield_evidence()}</h2>
				{#if !evidence}
					<p class="text-sm text-zinc-500">{m.shield_evidence_empty()}</p>
				{:else}
					<p
						class="rounded-lg border px-3 py-2 text-sm {evidence.tier === 'none'
							? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
							: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}"
					>
						{tierLabel}
					</p>

					{#if evidence.arguments.length}
						<h3 class="text-sm font-semibold text-zinc-300">{m.shield_cards()}</h3>
						{#each evidence.arguments as a (a.id)}
							<article class="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<div class="flex flex-wrap items-center gap-2">
										<ReviewBadge state={a.review} />
										<span class="text-xs font-medium text-amber-300/90">{a.core_principle}</span>
										{#if a.machineTranslated}
											<span class="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">{m.shield_machine_translation()}</span>
										{/if}
										{#if a.isFallback}<span class="text-xs text-amber-300">{languageLabel(a.locale)}</span>{/if}
									</div>
								</div>
								<p><span class="text-xs text-zinc-500">{m.shield_attack()}:</span> {a.opponent_claim}</p>
								<p><span class="text-xs text-zinc-500">{m.shield_suggested()}:</span> {a.counter_punch}</p>
							</article>
						{/each}
					{/if}

					{#if (evidence.posters && evidence.posters.length) || (evidence.media && evidence.media.length)}
						<h3 class="text-sm font-semibold text-zinc-300">{m.shield_linked_visuals()}</h3>
						<div class="grid gap-3 sm:grid-cols-2">
							{#each evidence.posters ?? [] as p (p.id)}
								<a href="/media" class="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 transition hover:border-amber-500/40">
									<img src={p.image_path} alt={p.title} class="h-32 w-full object-cover" loading="lazy" />
									<div class="p-2.5 text-xs">
										<div class="font-semibold text-zinc-100 group-hover:text-amber-300">{p.title}</div>
										{#if p.caption_pl}<p class="mt-0.5 line-clamp-2 text-zinc-400">{p.caption_pl}</p>{/if}
									</div>
								</a>
							{/each}
							{#each evidence.media ?? [] as item (item.id)}
								<a href="/media?select={item.id}" class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs hover:border-amber-500/40">
									<div class="font-semibold text-amber-300">{item.title}</div>
									<div class="text-zinc-400">{item.artist} · {item.genre}</div>
								</a>
							{/each}
						</div>
					{/if}

					{#if evidence.sources.length}
						<h3 class="text-sm font-semibold text-zinc-300">{m.shield_sources()}</h3>
						{#each evidence.sources as s (s.id)}
							<article
								id="ev-{s.id}"
								class="space-y-2 rounded-xl border bg-zinc-900/40 p-3 text-sm transition-colors {citedIds.has(s.id)
									? 'border-amber-500/60'
									: 'border-zinc-800'} {highlighted === s.id ? 'bg-amber-500/10' : ''}"
							>
								<div class="flex flex-wrap items-center gap-2">
									<span class="font-semibold">{s.work} {s.section_ref}</span>
									<ReviewBadge state={s.review} />
									{#if citedIds.has(s.id)}
										<span class="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">{m.shield_cited()}</span>
									{/if}
								</div>
								{#if s.isFallback}
									<p class="text-xs text-amber-300">
										{m.repo_fallback({ target: languageLabel(evidence.outputLocale), shown: languageLabel(s.locale) })}
									</p>
								{/if}
								{#if s.machineTranslated}<p class="text-xs text-amber-300">{m.shield_machine_translation()}</p>{/if}
								<blockquote class="whitespace-pre-line text-zinc-300">{s.text}</blockquote>
								<div class="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
									{#if s.translator}<span>{m.f_translator()}: {s.translator}</span>{/if}
									<span>{m.repo_license()}: {s.license}</span>
									{#if s.url}
										<a href={s.url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-sky-400 hover:underline">
											<ExternalLink class="h-3 w-3" />{m.repo_open_source()}
										</a>
									{/if}
								</div>
							</article>
						{/each}
					{/if}
				{/if}
			</aside>
		</div>
	{:else if activeTab === 'deconstruct'}
		<!-- Multi-Claim Opponent Letter Deconstructor -->
		<section class="space-y-6">
			<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 class="text-xl font-bold text-zinc-100">{m.shield_deconstruct_title()}</h2>
						<p class="mt-1 text-sm text-zinc-400">{m.shield_deconstruct_intro()}</p>
					</div>
					{#if inboundLetters.length}
						<select
							onchange={(e) => {
								const val = (e.currentTarget as HTMLSelectElement).value;
								const found = inboundLetters.find((l) => String(l.id) === val);
								if (found) deconstructText = found.body;
							}}
							class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
						>
							<option value="">{m.shield_deconstruct_load_letter()}</option>
							{#each inboundLetters as l (l.id)}
								<option value={l.id}>{l.filename} ({l.date_label}) — {l.sender}</option>
							{/each}
						</select>
					{/if}
				</div>

				<form method="POST" action="?/deconstruct" use:enhance class="mt-4 space-y-3">
					<textarea
						name="letter_text"
						bind:value={deconstructText}
						rows="7"
						required
						placeholder="Wklej tutaj wielo-akapitowy list lub odpowiedź oponenta…"
						class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
					></textarea>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<label class="flex items-center gap-2 text-xs text-zinc-400">
							<input type="checkbox" name="include_drafts" checked={includeDrafts} />
							{m.shield_include_drafts()}
						</label>
						<div class="flex flex-wrap items-center gap-2">
							{#if deconstructText.trim()}
								<a
									href="/content?platform=letter&brief={encodeURIComponent(deconstructText.trim().slice(0, 1200))}"
									class="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
								>
									<PenLine class="h-3.5 w-3.5" />
									{m.shield_deconstruct_draft_full()}
								</a>
							{/if}
							<button
								type="submit"
								class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
							>
								<Sparkles class="h-4 w-4" />
								{m.shield_deconstruct_run()}
							</button>
						</div>
					</div>
				</form>
			</div>

			{#if form?.deconstructed?.claims?.length}
				<div class="space-y-4">
					{#each form.deconstructed.claims as item (item.index)}
						<article class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div class="flex flex-wrap items-center gap-2">
									<span class="rounded-md bg-amber-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-300">
										{m.shield_deconstruct_claim_n({ n: item.index })}
									</span>
									<span class="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-0.5 text-xs font-medium text-sky-300">
										{methodologyLabel(item.methodology)}
									</span>
								</div>
								<div class="flex flex-wrap items-center gap-2">
									<button
										type="button"
										onclick={() => send(item.claim)}
										class="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
									>
										<Send class="h-3 w-3" />
										{m.shield_deconstruct_send_claim()}
									</button>
									<a
										href="/content?platform=letter&brief={encodeURIComponent(item.claim)}"
										class="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
									>
										<PenLine class="h-3 w-3" />
										{m.shield_to_letter()}
									</a>
								</div>
							</div>

							<blockquote class="border-l-2 border-rose-500/50 pl-3 text-sm italic text-zinc-200">
								„{item.claim}”
							</blockquote>

							{#if item.arguments.length}
								<div class="space-y-2 pt-1">
									<div class="text-xs font-semibold uppercase tracking-wide text-emerald-400">{m.shield_cards()}</div>
									{#each item.arguments as a (a.id)}
										<div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm">
											<div class="flex flex-wrap items-center gap-2 text-xs">
												<ReviewBadge state={a.review} />
												<span class="font-semibold text-amber-300">{a.core_principle}</span>
											</div>
											<p class="mt-1.5 text-zinc-200">{a.counter_punch}</p>
										</div>
									{/each}
								</div>
							{/if}

							{#if item.sources.length}
								<div class="space-y-1.5 pt-1">
									<div class="text-xs font-semibold uppercase tracking-wide text-zinc-400">{m.shield_sources()}</div>
									<div class="grid gap-2 md:grid-cols-2">
										{#each item.sources as s (s.id)}
											<div class="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-2.5 text-xs">
												<div class="font-semibold text-zinc-200">{s.work} {s.section_ref}</div>
												<p class="mt-1 line-clamp-3 text-zinc-400">„{s.text}”</p>
												<div class="mt-1 text-zinc-500">{s.translator ? `${s.translator} · ` : ''}{m.repo_license()}: {s.license}</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</section>
	{:else if activeTab === 'dossier'}
		<!-- Epistolary Dossier: corpus/intake/letters_archive/Korona/ (the database is the authority) -->
		<section class="space-y-6">
			<div class="rounded-xl border border-amber-500/30 bg-zinc-900/50 p-5">
				<h2 class="text-xl font-bold text-zinc-100">{m.shield_dossier_title()}</h2>
				<p class="mt-1 text-sm text-zinc-300">{m.shield_dossier_intro()}</p>
			</div>

			<div class="space-y-4">
				{#each data.korona?.letters ?? [] as letter (letter.id)}
					<article
						class="rounded-xl border p-4 {letter.direction === 'outbound'
							? 'border-amber-500/30 bg-amber-500/5'
							: 'border-sky-500/30 bg-sky-500/5'}"
					>
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div class="flex flex-wrap items-center gap-2 text-xs">
								<span
									class="rounded-full px-2.5 py-0.5 font-semibold {letter.direction === 'outbound'
										? 'bg-amber-500/20 text-amber-300'
										: 'bg-sky-500/20 text-sky-300'}"
								>
									#{letter.turn_number} · {letter.direction === 'outbound' ? m.shield_dossier_outbound() : m.shield_dossier_inbound()}
								</span>
								<span class="font-mono text-zinc-400">{letter.filename}</span>
								<span class="text-zinc-400">· {letter.date_label}</span>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								{#if letter.direction === 'inbound'}
									<button
										type="button"
										onclick={() => loadIntoDeconstructor(letter.body)}
										class="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
									>
										<Sparkles class="h-3 w-3" />
										{m.shield_dossier_deconstruct_btn()}
									</button>
									<a
										href="/content?platform=letter&brief={encodeURIComponent(letter.body.slice(0, 1200))}"
										class="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
									>
										<PenLine class="h-3 w-3" />
										{m.shield_dossier_reply_btn()}
									</a>
								{/if}
							</div>
						</div>

						<p class="mt-2 text-sm font-medium text-zinc-100">{letter.summary_pl}</p>
						<p class="mt-0.5 text-xs text-zinc-400">{letter.summary_en}</p>

						{#if letter.key_claims.length}
							<div class="mt-3 flex flex-wrap gap-1.5">
								{#each letter.key_claims as claim, idx (idx)}
									<button
										type="button"
										onclick={() => send(claim)}
										title="Wyślij tę tezę do Tarczy"
										class="max-w-full truncate rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1 text-left text-xs text-zinc-300 hover:border-amber-500/50 hover:text-amber-200"
									>
										„{claim.slice(0, 110)}{claim.length > 110 ? '…' : ''}”
									</button>
								{/each}
							</div>
						{/if}

						<details class="mt-3 text-xs">
							<summary class="cursor-pointer font-medium text-zinc-400 hover:text-zinc-200">
								Pełna treść listu ({letter.filename})
							</summary>
							<pre class="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 font-sans text-xs leading-relaxed text-zinc-300">{letter.body}</pre>
						</details>

						{#if letter.direction === 'outbound' && letter.key_claims.length}
							<details class="mt-2 rounded-lg border border-amber-500/30 bg-zinc-950/60 p-2.5 text-xs">
								<summary class="cursor-pointer font-semibold text-amber-300">
									+ {m.arg_add()} ({letter.filename})
								</summary>
								<form method="POST" action="?/extractCard" use:enhance class="mt-2.5 space-y-2">
									<input
										name="opponent_claim"
										required
										placeholder={m.f_claim()}
										value={data.korona?.letters.find((x) => x.turn_number === letter.turn_number - 1)?.summary_pl ?? ''}
										class="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100"
									/>
									<textarea
										name="counter_punch"
										rows="3"
										required
										class="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100"
									>{letter.key_claims[0]}</textarea>
									<div class="grid gap-2 sm:grid-cols-2">
										<input
											name="core_principle"
											required
											value="Doktryna Oazy Pokoju (Dysputa Tomistyczna)"
											placeholder={m.f_principle()}
											class="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100"
										/>
										<select name="source_ids" class="w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100">
											{#each data.sourcesList ?? [] as s (s.id)}
												<option value={s.id}>{s.label}</option>
											{/each}
										</select>
									</div>
									<button type="submit" class="rounded bg-amber-500 px-3 py-1 font-semibold text-zinc-950 hover:bg-amber-400">
										{m.repo_save()}
									</button>
								</form>
							</details>
						{/if}
					</article>
				{/each}
			</div>
		</section>
	{/if}
</div>
