<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { PublishedSummary } from '$lib/server/journal';
	import type { JournalLang } from '$lib/journal-paths';
	import PublicArticleCard from './PublicArticleCard.svelte';

	/** One side of a rozprawa: the published text, or a plain note that this calibre is still being written. */
	let { article, caliber, lang }: { article: PublishedSummary | null; caliber: 'light' | 'heavy'; lang: JournalLang } = $props();
	const o = $derived({ locale: lang });
	const tone = $derived(caliber === 'heavy' ? 'text-crimson-300' : 'text-amber-300');
</script>

<div class="px-1 md:px-0">
	<!-- The column heading scrolls away on a phone, so each cell names its calibre itself there. -->
	<p class="pt-3 text-xs font-semibold tracking-wider uppercase md:hidden {tone}">
		{caliber === 'heavy' ? m.journal_caliber_heavy({}, o) : m.journal_caliber_light({}, o)}
	</p>
	{#if article}
		<PublicArticleCard {article} {lang} />
	{:else}
		<p class="py-3 text-sm text-zinc-500 italic">{m.pub_in_progress({}, o)}</p>
	{/if}
</div>
