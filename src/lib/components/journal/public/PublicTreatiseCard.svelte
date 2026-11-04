<script lang="ts">
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import type { TreatisePair } from '$lib/journal-pairs';
	import type { JournalLang } from '$lib/journal-paths';
	import { m } from '$lib/paraglide/messages.js';
	import PublicCaliberPanel from './PublicCaliberPanel.svelte';
	import PublicVersionBadge from './PublicVersionBadge.svelte';

	/** One rozprawa as an accordion: the shared title and what exists in the header, the two versions inside. */
	let { pair, lang, open = false }: { pair: TreatisePair; lang: JournalLang; open?: boolean } = $props();
	// The two versions share a title; the heavy one is the reference when they differ.
	const main = $derived(pair.heavy ?? pair.light);
</script>

{#if main}
	<details {open} class="group rounded-xl border border-zinc-800 bg-zinc-900/30">
		<summary class="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 p-3 sm:px-4 [&::-webkit-details-marker]:hidden">
			<ChevronRight class="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-90" />
			<h3 class="min-w-0 flex-1 basis-60 font-serif text-lg leading-snug font-bold text-zinc-50 sm:text-xl">{main.title}</h3>
			<span class="flex items-center gap-1.5">
				<PublicVersionBadge article={pair.light} caliber="light" {lang} />
				<PublicVersionBadge article={pair.heavy} caliber="heavy" {lang} />
			</span>
			<span class="text-xs text-zinc-500">{main.author ?? m.pub_editorial({}, { locale: lang })} · {main.published_at.slice(0, 10)}</span>
		</summary>
		<div class="grid gap-3 p-3 pt-0 sm:px-4 sm:pb-4 md:grid-cols-2">
			<PublicCaliberPanel article={pair.light} caliber="light" {lang} />
			<PublicCaliberPanel article={pair.heavy} caliber="heavy" {lang} />
		</div>
	</details>
{/if}
