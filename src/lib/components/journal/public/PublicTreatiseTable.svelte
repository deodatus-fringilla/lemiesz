<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { TreatisePair } from '$lib/journal-pairs';
	import type { JournalLang } from '$lib/journal-paths';
	import PublicPairCell from './PublicPairCell.svelte';

	/** The front page list: one row per rozprawa, light calibre on the left and heavy on the right. */
	let { pairs, lang }: { pairs: TreatisePair[]; lang: JournalLang } = $props();
	const o = $derived({ locale: lang });
	const cols = $derived([
		{ caliber: 'light' as const, title: m.journal_caliber_light({}, o), desc: m.pub_light_desc({}, o), tone: 'border-amber-500/40 text-amber-300' },
		{ caliber: 'heavy' as const, title: m.journal_caliber_heavy({}, o), desc: m.pub_heavy_desc({}, o), tone: 'border-crimson-500/50 font-serif text-crimson-300' }
	]);
</script>

<div>
	<div class="hidden gap-x-10 md:grid md:grid-cols-2">
		{#each cols as c (c.caliber)}
			<a href="?kaliber={c.caliber}" class="block border-b pb-2 {c.tone.split(' ')[0]}">
				<h2 class="text-xl font-bold {c.tone.split(' ').slice(1).join(' ')}">{c.title}</h2>
				<p class="text-sm text-zinc-400">{c.desc}</p>
			</a>
		{/each}
	</div>
	{#if pairs.length === 0}<p class="py-4 text-sm text-zinc-500">{m.pub_empty({}, o)}</p>{/if}
	<div class="divide-y divide-zinc-800/80">
		{#each pairs as p (p.light?.slug ?? p.heavy?.slug)}
			<div class="grid gap-x-10 md:grid-cols-2">
				<PublicPairCell article={p.light} caliber="light" {lang} />
				<PublicPairCell article={p.heavy} caliber="heavy" {lang} />
			</div>
		{/each}
	</div>
</div>
