<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { PublishedSummary } from '$lib/server/journal';
	import { articlePath, type JournalLang } from '$lib/journal-paths';
	import JournalCaliberBadge from '../JournalCaliberBadge.svelte';
	import PublicAbstractModal from './PublicAbstractModal.svelte';

	/** One version of a rozprawa: its calibre, reading time and the two ways in (abstract, text); or a note that it is still being written. */
	let { article, caliber, lang }: { article: PublishedSummary | null; caliber: 'light' | 'heavy'; lang: JournalLang } = $props();
	const o = $derived({ locale: lang });
	const tone = $derived(caliber === 'heavy' ? 'border-crimson-500/40 bg-crimson-500/5' : 'border-amber-500/40 bg-amber-500/5');
</script>

<div class="flex flex-col justify-between gap-4 rounded-lg border p-4 {article ? tone : 'border-dashed border-zinc-800'}">
	<div class="space-y-1.5">
		<JournalCaliberBadge {caliber} {lang} />
		{#if article}
			<p class="text-sm text-zinc-400">{caliber === 'heavy' ? m.journal_caliber_heavy_hint({}, o) : m.journal_caliber_light_hint({}, o)} · {m.pub_minutes({ n: article.minutes }, o)}</p>
		{:else}
			<p class="text-sm text-zinc-500 italic">{m.pub_in_progress({}, o)}</p>
		{/if}
	</div>
	{#if article}
		<div class="flex flex-wrap gap-2">
			{#if article.lead}<PublicAbstractModal {article} {lang} />{/if}
			<a href={articlePath(lang, article.slug)} class="inline-flex rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400">{m.pub_read({}, o)}</a>
		</div>
	{/if}
</div>
