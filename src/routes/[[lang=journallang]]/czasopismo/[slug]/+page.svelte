<script lang="ts">
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import { m } from '$lib/paraglide/messages.js';
	import { articlePath, feedPath, journalHome } from '$lib/journal-paths';
	import JournalCaliberBadge from '$lib/components/journal/JournalCaliberBadge.svelte';
	import JournalHead from '$lib/components/journal/public/JournalHead.svelte';
	import JournalMasthead from '$lib/components/journal/public/JournalMasthead.svelte';
	import PublicArticleBody from '$lib/components/journal/public/PublicArticleBody.svelte';
	import PublicFootnotes from '$lib/components/journal/public/PublicFootnotes.svelte';
	import PublicTwinCallout from '$lib/components/journal/public/PublicTwinCallout.svelte';

	let { data } = $props();
	const a = $derived(data.article);
	const o = $derived({ locale: data.lang });
	const tags = $derived((a.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean));
	const url = $derived(`${data.origin}${articlePath(data.lang, a.slug)}`);
	const hasColumns = $derived(data.blocks.some((b) => b.type === 'columns' || (b.type === 'image' && b.size !== 'column')));
</script>

<JournalHead
	title={`${a.title} · Lemiesz.`}
	description={a.lead || m.pub_tagline({}, o)}
	{url}
	lang={data.lang}
	type="article"
	feed={feedPath(data.lang)}
	publishedAt={a.published_at}
	alternates={data.other ? [{ lang: data.lang, url }, { lang: data.other.lang, url: `${data.origin}${data.other.href}` }] : []}
/>

<div class="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
	<JournalMasthead lang={data.lang} current="articles" other={data.other} />

	<article class="mx-auto space-y-6 {hasColumns ? 'max-w-5xl' : 'max-w-[68ch]'}">
		<a href={journalHome(data.lang)} class="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-amber-300"><ArrowLeft class="h-4 w-4" />{m.pub_back_home({}, o)}</a>
		<header class="space-y-3">
			<JournalCaliberBadge caliber={a.caliber} lang={data.lang} />
			<h1 class="text-3xl leading-tight font-bold text-zinc-50 sm:text-4xl {a.caliber === 'heavy' ? 'font-serif' : ''}">{a.title}</h1>
			{#if a.lead}<p class="text-lg leading-relaxed text-zinc-300">{a.lead}</p>{/if}
			<p class="text-sm text-zinc-500">
				{a.author ?? m.pub_editorial({}, o)} · <time datetime={a.published_at.slice(0, 10)}>{m.pub_published({ date: a.published_at.slice(0, 10) }, o)}</time>
			</p>
		</header>

		<PublicArticleBody blocks={data.blocks} caliber={a.caliber} breakout />
		<PublicFootnotes notes={data.notes} lang={data.lang} />
		{#if a.twin}<PublicTwinCallout twin={a.twin} lang={data.lang} />{/if}

		{#if tags.length}
			<p class="flex flex-wrap gap-2 text-xs">
				{#each tags as t (t)}<a href="{journalHome(data.lang)}?tag={encodeURIComponent(t)}" class="rounded border border-zinc-700 px-2 py-0.5 text-zinc-400 hover:border-amber-500/50 hover:text-amber-300">#{t}</a>{/each}
			</p>
		{/if}
	</article>
</div>
