<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { TreatisePair } from '$lib/journal-pairs';
	import type { JournalLang } from '$lib/journal-paths';
	import PublicTreatiseCard from './PublicTreatiseCard.svelte';

	/** The front page list: a card per rozprawa, newest first, with a shortcut to list only one calibre. */
	let { pairs, lang }: { pairs: TreatisePair[]; lang: JournalLang } = $props();
	const o = $derived({ locale: lang });
</script>

<section class="space-y-4">
	<p class="flex flex-wrap items-center gap-x-4 text-sm text-zinc-500">
		{m.pub_only({}, o)}
		<a href="?kaliber=light" class="text-amber-300 hover:underline">{m.journal_caliber_light({}, o)}</a>
		<a href="?kaliber=heavy" class="font-serif text-crimson-300 hover:underline">{m.journal_caliber_heavy({}, o)}</a>
	</p>
	{#if pairs.length === 0}<p class="py-4 text-sm text-zinc-500">{m.pub_empty({}, o)}</p>{/if}
	{#each pairs as p (p.light?.slug ?? p.heavy?.slug)}<PublicTreatiseCard pair={p} {lang} />{/each}
</section>
