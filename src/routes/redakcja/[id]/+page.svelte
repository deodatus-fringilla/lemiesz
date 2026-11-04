<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import { m } from '$lib/paraglide/messages.js';
	import JournalCaliberBadge from '$lib/components/journal/JournalCaliberBadge.svelte';
	import JournalCitationList from '$lib/components/journal/JournalCitationList.svelte';
	import JournalLocaleTabs from '$lib/components/journal/JournalLocaleTabs.svelte';
	import JournalMetaForm from '$lib/components/journal/JournalMetaForm.svelte';
	import JournalReviewPanel from '$lib/components/journal/JournalReviewPanel.svelte';
	import JournalTextEditor from '$lib/components/journal/JournalTextEditor.svelte';

	let { data, form } = $props();
	const blocked = $derived(data.citations.some((c) => c.problem));
	const anyLive = $derived(data.text?.published_body != null);
	let dirty = $state(false);
	let wide = $state(false);
</script>

<svelte:head><title>{data.text?.title ?? m.journal_backoffice_title()} · {m.app_title()}</title></svelte:head>

<div class="space-y-4">
	<a href="/redakcja" class="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-amber-300"><ArrowLeft class="h-4 w-4" />{m.journal_back()}</a>

	<div class="flex flex-wrap items-center gap-3">
		<JournalCaliberBadge caliber={data.article.caliber} />
		<JournalLocaleTabs articleId={data.article.id} locales={data.locales} allLocales={data.allLocales} current={data.locale} />
		<span class="font-mono text-xs text-zinc-500">/{data.article.slug}</span>
	</div>

	{#if form?.error}<p role="alert" class="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{form.error}</p>{/if}
	{#if !data.text}<p class="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-200">{m.journal_new_language({ lang: data.locale.toUpperCase() })}</p>{/if}

	<div class="grid gap-5 {wide ? '' : 'xl:grid-cols-[minmax(0,1fr)_20rem]'}">
		<JournalTextEditor text={data.text} locale={data.locale} caliber={data.article.caliber} sources={data.sources} images={data.images} media={data.media} bind:dirty bind:wide />
		<aside class={wide ? 'grid items-start gap-4 lg:grid-cols-3' : 'space-y-4'}>
			{#if data.text}
				<JournalReviewPanel text={data.text} locale={data.locale} approvals={data.approvals} counted={data.counted} required={data.required} {dirty} me={data.me} {blocked} />
				<JournalCitationList citations={data.citations} />
			{/if}
			<JournalMetaForm article={data.article} twins={data.twins} />
			{#if !anyLive}
				<form method="POST" action="?/delete" use:enhance onsubmit={(e) => !confirm(m.journal_delete_confirm()) && e.preventDefault()}>
					<button class="w-full rounded-lg border border-rose-500/25 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10">{m.journal_delete_article()}</button>
				</form>
			{/if}
		</aside>
	</div>
</div>
