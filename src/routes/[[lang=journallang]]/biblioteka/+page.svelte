<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { feedPath, libraryPath } from '$lib/journal-paths';
	import JournalHead from '$lib/components/journal/public/JournalHead.svelte';
	import JournalMasthead from '$lib/components/journal/public/JournalMasthead.svelte';
	import PublicLibraryItem from '$lib/components/journal/public/PublicLibraryItem.svelte';
	import { linkTypeLabel } from '$lib/components/journal/journal-ui';

	let { data } = $props();
	const o = $derived({ locale: data.lang });
	const chip = (active: boolean) => `rounded-full border px-3 py-1 text-xs transition ${active ? 'border-amber-500/50 bg-amber-500/15 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'}`;
</script>

<JournalHead title={`${m.pub_nav_library({}, o)} · Lemiesz.`} description={m.pub_library_intro({}, o)} url={`${data.origin}${libraryPath(data.lang)}`} lang={data.lang} feed={feedPath(data.lang)} />

<div class="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
	<JournalMasthead lang={data.lang} current="library" other={data.lang === 'en' ? { lang: 'pl', href: libraryPath('pl') } : null} />
	<p class="max-w-2xl text-zinc-300">{m.pub_library_intro({}, o)}</p>

	{#if data.types.length > 1}
		<nav class="flex flex-wrap gap-2" aria-label={m.pub_nav_library({}, o)}>
			<a href={libraryPath(data.lang)} class={chip(!data.active)}>{m.pub_all_types({}, o)}</a>
			{#each data.types as t (t)}<a href="?typ={t}" class={chip(data.active === t)}>{linkTypeLabel(t, data.lang)}</a>{/each}
		</nav>
	{/if}

	{#if data.items.length === 0}
		<p class="text-zinc-500">{m.pub_library_empty({}, o)}</p>
	{:else}
		<ul class="grid gap-4 md:grid-cols-2">
			{#each data.items as item (item.id)}<PublicLibraryItem {item} lang={data.lang} />{/each}
		</ul>
	{/if}
</div>
