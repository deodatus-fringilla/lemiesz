<script lang="ts">
	import { enhance } from '$app/forms';
	import Feather from 'lucide-svelte/icons/feather';
	import { m } from '$lib/paraglide/messages.js';
	import JournalArticleTable from '$lib/components/journal/JournalArticleTable.svelte';
	import JournalNewArticleForm from '$lib/components/journal/JournalNewArticleForm.svelte';
	import JournalLinkForm from '$lib/components/journal/JournalLinkForm.svelte';
	import JournalBackofficeLinks from '$lib/components/journal/JournalBackofficeLinks.svelte';
	import JournalLinkList from '$lib/components/journal/JournalLinkList.svelte';

	let { data, form } = $props();
	let checking = $state(false);
	const tabs = $derived([
		{ id: 'rozprawy', label: m.journal_tab_articles(), n: new Set(data.articles.map((a) => a.id)).size },
		{ id: 'biblioteka', label: m.journal_tab_library(), n: data.links.length }
	]);
	const err = (which: string) => (form?.form === which || (!form?.form && which === 'article') ? (form?.error ?? null) : null);
</script>

<svelte:head><title>{m.journal_backoffice_title()} · {m.app_title()}</title></svelte:head>

<div class="space-y-5">
	<header class="space-y-1">
		<h1 class="flex items-center gap-2.5 text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
			<Feather class="h-6 w-6 text-amber-400" />{m.journal_backoffice_title()}
		</h1>
		<p class="text-sm text-zinc-400">{m.journal_name()}</p>
		<JournalBackofficeLinks />
	</header>

	<nav class="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-sm" aria-label={m.journal_backoffice_title()}>
		{#each tabs as t (t.id)}
			<a href="?tab={t.id}" aria-current={data.tab === t.id ? 'page' : undefined}
				class="rounded-md px-3 py-1.5 font-medium transition {data.tab === t.id ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'}">
				{t.label} <span class="font-mono text-xs opacity-70">{t.n}</span>
			</a>
		{/each}
	</nav>

	{#if data.tab === 'rozprawy'}
		<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
			<JournalArticleTable articles={data.articles} />
			<JournalNewArticleForm error={err('article')} />
		</div>
	{:else}
		<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
			<div class="space-y-3">
				<form method="POST" action="?/checkLinks" use:enhance={() => { checking = true; return async ({ update }) => { await update({ reset: false }); checking = false; }; }} class="flex flex-wrap items-center gap-3">
					<button disabled={checking} class="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">{checking ? m.journal_links_checking() : m.journal_links_check()}</button>
					{#if form && 'checked' in form}<span class="text-sm text-zinc-400">{m.journal_links_checked({ checked: form.checked ?? 0, broken: form.broken ?? 0 })}</span>{/if}
				</form>
				<JournalLinkList links={data.links} linkTypes={data.linkTypes} error={err('link')} />
			</div>
			<JournalLinkForm linkTypes={data.linkTypes} error={err('link')} />
		</div>
	{/if}
</div>
