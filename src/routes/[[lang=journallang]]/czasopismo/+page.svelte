<script lang="ts">
	import Search from 'lucide-svelte/icons/search';
	import { m } from '$lib/paraglide/messages.js';
	import { feedPath, journalHome } from '$lib/journal-paths';
	import JournalHead from '$lib/components/journal/public/JournalHead.svelte';
	import JournalMasthead from '$lib/components/journal/public/JournalMasthead.svelte';
	import PublicArticleCard from '$lib/components/journal/public/PublicArticleCard.svelte';
	import PublicTreatiseList from '$lib/components/journal/public/PublicTreatiseList.svelte';

	let { data } = $props();
	const o = $derived({ locale: data.lang });
</script>

<JournalHead
	title={m.journal_name({}, o)}
	description={m.pub_tagline({}, o)}
	url={`${data.origin}${journalHome(data.lang)}`}
	lang={data.lang}
	feed={feedPath(data.lang)}
	alternates={data.hasEnglish ? [{ lang: 'pl', url: `${data.origin}${journalHome('pl')}` }, { lang: 'en', url: `${data.origin}${journalHome('en')}` }] : []}
/>

<div class="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
	<JournalMasthead lang={data.lang} current="articles" other={data.hasEnglish ? { lang: 'en', href: journalHome('en') } : data.lang === 'en' ? { lang: 'pl', href: journalHome('pl') } : null} />

	<form method="GET" class="relative max-w-xl" role="search">
		<Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
		<input type="search" name="q" value={data.q} placeholder={m.pub_search_placeholder({}, o)} aria-label={m.pub_search_placeholder({}, o)}
			class="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pr-3 pl-9 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none" />
	</form>

	{#if data.filtered}
		<section class="space-y-2">
			<div class="flex items-baseline justify-between gap-3">
				<h2 class="text-sm font-semibold tracking-wider text-zinc-400 uppercase">{m.pub_results({ count: data.results.length }, o)}</h2>
				<a href={journalHome(data.lang)} class="text-sm text-amber-300 hover:underline">{m.pub_clear_filters({}, o)}</a>
			</div>
			{#if data.results.length === 0}<p class="text-zinc-500">{m.pub_no_results({}, o)}</p>{/if}
			<div class="divide-y divide-zinc-800/80">
				{#each data.results as a (a.id)}<PublicArticleCard article={a} lang={data.lang} showCaliber />{/each}
			</div>
		</section>
	{:else}
		<PublicTreatiseList pairs={data.pairs} lang={data.lang} />
	{/if}
</div>
