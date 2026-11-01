<script lang="ts">
	import type { KuzniaDeliberation } from '$lib/server/kuznia';
	import ExternalLink from 'lucide-svelte/icons/external-link';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
	import ChevronUp from 'lucide-svelte/icons/chevron-up';
	import Quote from 'lucide-svelte/icons/quote';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		deliberation: KuzniaDeliberation;
	}

	let { deliberation }: Props = $props();

	let showTextDrawer = $state(false);

	const isYouTube = $derived(
		deliberation.item_type === 'media' && deliberation.media?.platform === 'youtube' && deliberation.media?.embed_url
	);

	const hasLyricsOrText = $derived(
		(deliberation.item_type === 'media' && !!deliberation.media?.lyrics_or_transcript) ||
		(deliberation.item_type === 'source' && !!deliberation.source?.text)
	);
</script>

<div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 shadow-sm space-y-4">
	<!-- Header with object title & external link -->
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="space-y-1">
			<h2 class="text-lg sm:text-xl font-bold text-zinc-100">{deliberation.title}</h2>
			{#if deliberation.item_type === 'media' && deliberation.media?.artist_or_author}
				<p class="text-xs text-amber-400 font-medium">
					Autor / Wykonawca: <span class="text-zinc-300">{deliberation.media.artist_or_author}</span>
				</p>
			{:else}
				{#if deliberation.item_type === 'source' && deliberation.source}
					<p class="text-xs text-emerald-400 font-medium">
						Źródło: <span class="text-zinc-300">{deliberation.source.work} · {deliberation.source.section_ref}</span>
					</p>
				{/if}
			{/if}
		</div>

		{#if deliberation.item_type === 'media' && deliberation.media?.url}
			<a
				href={deliberation.media.url}
				target="_blank"
				rel="noreferrer"
				class="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
			>
				<span>Otwórz źródło</span>
				<ExternalLink class="size-3" />
			</a>
		{/if}
	</div>

	<!-- Media Display: YouTube Embed / Image / Scripture Block -->
	{#if isYouTube && deliberation.media}
		<div class="overflow-hidden rounded-lg border border-zinc-800 bg-black aspect-video max-w-2xl mx-auto">
			<iframe
				src={deliberation.media.embed_url}
				title={deliberation.media.title}
				class="w-full h-full border-0"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowfullscreen
			></iframe>
		</div>
	{:else}
		{#if deliberation.item_type === 'source' && deliberation.source}
			<div class="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4 font-serif text-sm leading-relaxed text-zinc-200">
				<p class="whitespace-pre-line">{deliberation.source.text}</p>
			</div>
		{/if}
	{/if}

	<!-- Key Quote Highlight -->
	{#if deliberation.key_quote}
		<div class="relative rounded-lg border-l-4 border-amber-500 bg-zinc-950/60 px-4 py-3 pl-5 text-sm italic text-amber-200">
			<Quote class="absolute -left-1.5 -top-2 size-4 text-amber-500 fill-amber-500 opacity-60" />
			„{deliberation.key_quote}”
		</div>
	{/if}

	<!-- Lyrics or source text collapsible -->
	{#if hasLyricsOrText}
		<div class="border-t border-zinc-800/80 pt-3">
			<button
				type="button"
				onclick={() => (showTextDrawer = !showTextDrawer)}
				class="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 cursor-pointer"
			>
				{#if showTextDrawer}
					<ChevronUp class="size-3.5" />
				{:else}
					<ChevronDown class="size-3.5" />
				{/if}
				<span>{deliberation.item_type === 'media' ? m.kuznia_lyrics_label() : m.kuznia_source_passage()}</span>
			</button>

			{#if showTextDrawer}
				<div class="mt-2.5 rounded-md border border-zinc-800 bg-zinc-950/80 p-3.5 font-mono text-xs leading-relaxed text-zinc-300 max-h-60 overflow-y-auto whitespace-pre-line">
					{#if deliberation.item_type === 'media'}
						{deliberation.media?.lyrics_or_transcript}
					{:else}
						{deliberation.source?.text}
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
