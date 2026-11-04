<script lang="ts">
	import type { TreatisePair } from '$lib/journal-pairs';
	import type { JournalLang } from '$lib/journal-paths';
	import { m } from '$lib/paraglide/messages.js';
	import PublicCaliberPanel from './PublicCaliberPanel.svelte';

	/** One rozprawa: a shared title over its light and heavy versions, side by side. */
	let { pair, lang }: { pair: TreatisePair; lang: JournalLang } = $props();
	// The two versions share a title; the heavy one is the reference when they differ.
	const main = $derived(pair.heavy ?? pair.light);
</script>

{#if main}
	<article class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 sm:p-5">
		<header class="space-y-1">
			<h3 class="font-serif text-xl leading-snug font-bold text-zinc-50 sm:text-2xl">{main.title}</h3>
			<p class="text-xs text-zinc-500">{main.author ?? m.pub_editorial({}, { locale: lang })} · {main.published_at.slice(0, 10)}</p>
		</header>
		<div class="grid gap-3 md:grid-cols-2">
			<PublicCaliberPanel article={pair.light} caliber="light" {lang} />
			<PublicCaliberPanel article={pair.heavy} caliber="heavy" {lang} />
		</div>
	</article>
{/if}
