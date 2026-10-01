<script lang="ts">
	import { ExternalLink, Send, TriangleAlert } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';
	import ReviewBadge from '$lib/components/ReviewBadge.svelte';
	import { languageLabel } from '$lib/i18n/labels';
	import type { ShieldEvent } from '$lib/server/shield/shield';

	type Evidence = Extract<ShieldEvent, { type: 'sources' }>;
	type Cite = { n: number; id: number; work: string; section_ref: string; text: string; locale: string; review: string };
	type Msg = { role: 'user' | 'assistant'; text: string; citations: Cite[]; noSource?: boolean; unverified: string[]; error?: boolean; watermark?: boolean };

	let { data } = $props();

	let messages = $state<Msg[]>([]);
	let evidence = $state<Evidence | null>(null);
	let conversationId = $state<string | null>(null);
	let input = $state('');
	let busy = $state(false);
	let includeDrafts = $state(false);
	let highlighted = $state<number | null>(null);

	// Load a stored conversation when the URL points at one (re-runs on navigation).
	$effect(() => {
		conversationId = data.conversationId;
		messages = data.history.map((h) => ({ ...h, citations: h.citations as Cite[] }));
		evidence = null;
	});

	const presets = $derived([
		{ name: m.shield_preset_swiss_name(), text: m.shield_preset_swiss_text() },
		{ name: m.shield_preset_double_name(), text: m.shield_preset_double_text() },
		{ name: m.shield_preset_paradox_name(), text: m.shield_preset_paradox_text() }
	]);

	const citedIds = $derived(new Set(messages.at(-1)?.citations.map((c) => c.id) ?? []));
	const tierLabel = $derived(
		evidence?.tier === 'arguments' ? m.shield_tier_arguments() : evidence?.tier === 'sources' ? m.shield_tier_sources() : m.shield_tier_none()
	);

	/** Splits answer text into plain parts and [n] citation markers. */
	function parts(text: string): { t: string; n?: number }[] {
		return text.split(/(\[\d+\])/).filter(Boolean).map((p) => {
			const mt = p.match(/^\[(\d+)\]$/);
			return mt ? { t: p, n: Number(mt[1]) } : { t: p };
		});
	}

	async function send() {
		const message = input.trim();
		if (!message || busy) return;
		busy = true;
		input = '';
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
							n: c.n, id: c.source.id, work: c.source.work, section_ref: c.source.section_ref,
							text: c.source.text, locale: c.source.locale, review: c.source.review
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
		history.replaceState(null, '', '/shield');
	}
</script>

<div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
	<section class="space-y-4">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">{m.shield_title()}</h1>
				<p class="mt-1 text-sm text-zinc-400">{m.shield_intro()}</p>
			</div>
			<button type="button" onclick={newConversation} class="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900">{m.shield_new()}</button>
		</div>

		{#if data.recent.length}
			<details class="text-sm">
				<summary class="cursor-pointer text-zinc-400">{m.shield_recent()}</summary>
				<ul class="mt-2 space-y-1">
					{#each data.recent as c (c.id)}
						<li><a class="text-sky-400 hover:underline" href="/shield?c={c.id}">{c.title ?? c.id}</a></li>
					{/each}
				</ul>
			</details>
		{/if}

		<div class="flex flex-wrap items-center gap-2 text-xs">
			<span class="text-zinc-500">{m.shield_presets()}:</span>
			{#each presets as p (p.name)}
				<button type="button" onclick={() => (input = p.text)} class="rounded-full border border-zinc-700 px-3 py-1 hover:bg-zinc-900">{p.name}</button>
			{/each}
		</div>

		<div class="min-h-64 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4" aria-live="polite">
			{#each messages as msg, i (i)}
				<div class={msg.role === 'user' ? 'text-zinc-200' : ''}>
					<div class="mb-1 text-xs font-semibold uppercase tracking-wide {msg.role === 'user' ? 'text-zinc-500' : 'text-amber-400'}">
						{msg.role === 'user' ? m.shield_you() : m.shield_assistant()}
					</div>
					<p class="whitespace-pre-line text-sm leading-relaxed {msg.error ? 'text-rose-300' : ''}">
						{#each parts(msg.text) as part, j (j)}
							{#if part.n}
								<button type="button" class="mx-0.5 rounded bg-amber-500/20 px-1 align-super text-[10px] font-bold text-amber-300 hover:bg-amber-500/40"
									onmouseenter={() => (highlighted = msg.citations.find((c) => c.n === part.n)?.id ?? null)}
									onmouseleave={() => (highlighted = null)}
									onclick={() => document.getElementById(`ev-${msg.citations.find((c) => c.n === part.n)?.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>{part.t}</button>
							{:else}{part.t}{/if}
						{/each}
						{#if busy && i === messages.length - 1 && !msg.text}<span class="text-zinc-500">{m.shield_sending()}</span>{/if}
					</p>
					{#if msg.unverified.length}
						<p role="alert" class="mt-2 flex items-start gap-2 rounded bg-rose-500/10 px-3 py-2 text-xs text-rose-300"><TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />{m.shield_unverified_warning()}</p>
					{/if}
					{#if msg.citations.length}
						<ol class="mt-3 space-y-2 border-l-2 border-amber-500/40 pl-3 text-xs">
							{#each msg.citations as c (c.n)}
								<li><span class="font-bold text-amber-300">[{c.n}]</span> <span class="font-semibold">{c.work} {c.section_ref}</span> <span class="text-zinc-500">({languageLabel(c.locale)})</span>
									<blockquote class="mt-0.5 text-zinc-400">„{c.text}”</blockquote></li>
							{/each}
						</ol>
					{/if}
				</div>
			{:else}
				<p class="text-sm text-zinc-500">{m.shield_evidence_empty()}</p>
			{/each}
		</div>

		{#if includeDrafts}
			<p role="status" class="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300"><TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />{m.shield_drafts_warning()}</p>
		{/if}

		<form onsubmit={(e) => { e.preventDefault(); send(); }} class="space-y-2">
			<textarea bind:value={input} rows="3" maxlength="2000" placeholder={m.shield_placeholder()} disabled={busy}
				onkeydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }}
				class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"></textarea>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<label class="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" bind:checked={includeDrafts} />{m.shield_include_drafts()}</label>
				<button disabled={busy || !input.trim()} class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"><Send class="h-4 w-4" />{m.shield_send()}</button>
			</div>
		</form>
	</section>

	<aside class="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label={m.shield_evidence()}>
		<h2 class="text-lg font-semibold">{m.shield_evidence()}</h2>
		{#if !evidence}
			<p class="text-sm text-zinc-500">{m.shield_evidence_empty()}</p>
		{:else}
			<p class="rounded-lg border px-3 py-2 text-sm {evidence.tier === 'none' ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}">{tierLabel}</p>

			{#if evidence.arguments.length}
				<h3 class="text-sm font-semibold text-zinc-300">{m.shield_cards()}</h3>
				{#each evidence.arguments as a (a.id)}
					<article class="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
						<div class="flex flex-wrap items-center gap-2"><ReviewBadge state={a.review} />
							{#if a.machineTranslated}<span class="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">{m.shield_machine_translation()}</span>{/if}
							{#if a.isFallback}<span class="text-xs text-amber-300">{languageLabel(a.locale)}</span>{/if}</div>
						<p><span class="text-xs text-zinc-500">{m.shield_attack()}:</span> {a.opponent_claim}</p>
						<p><span class="text-xs text-zinc-500">{m.shield_suggested()}:</span> {a.counter_punch}</p>
					</article>
				{/each}
			{/if}

			{#if evidence.sources.length}
				<h3 class="text-sm font-semibold text-zinc-300">{m.shield_sources()}</h3>
				{#each evidence.sources as s (s.id)}
					<article id="ev-{s.id}" class="space-y-2 rounded-xl border bg-zinc-900/40 p-3 text-sm transition-colors {citedIds.has(s.id) ? 'border-amber-500/60' : 'border-zinc-800'} {highlighted === s.id ? 'bg-amber-500/10' : ''}">
						<div class="flex flex-wrap items-center gap-2">
							<span class="font-semibold">{s.work} {s.section_ref}</span><ReviewBadge state={s.review} />
							{#if citedIds.has(s.id)}<span class="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">{m.shield_cited()}</span>{/if}
						</div>
						{#if s.isFallback}<p class="text-xs text-amber-300">{m.repo_fallback({ target: languageLabel(evidence.outputLocale), shown: languageLabel(s.locale) })}</p>{/if}
						{#if s.machineTranslated}<p class="text-xs text-amber-300">{m.shield_machine_translation()}</p>{/if}
						<blockquote class="whitespace-pre-line text-zinc-300">{s.text}</blockquote>
						<div class="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
							<span>{m.repo_license()}: {s.license}</span>
							{#if s.url}<a href={s.url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-sky-400 hover:underline"><ExternalLink class="h-3 w-3" />{m.repo_open_source()}</a>{/if}
						</div>
					</article>
				{/each}
			{/if}
		{/if}
	</aside>
</div>
