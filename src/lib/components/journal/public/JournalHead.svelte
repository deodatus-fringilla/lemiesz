<script lang="ts">
	import type { JournalLang } from '$lib/journal-paths';

	/** Title, description, canonical URL, language alternates, RSS and Open Graph for a public journal page. */
	let {
		title,
		description,
		url,
		lang,
		type = 'website',
		alternates = [],
		feed,
		publishedAt = null
	}: {
		title: string;
		description: string;
		url: string;
		lang: JournalLang;
		type?: 'website' | 'article';
		alternates?: { lang: JournalLang; url: string }[];
		feed: string;
		publishedAt?: string | null;
	} = $props();
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	{#each alternates as a (a.lang)}<link rel="alternate" hreflang={a.lang} href={a.url} />{/each}
	<link rel="alternate" type="application/rss+xml" title={title} href={feed} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content={type} />
	<meta property="og:url" content={url} />
	<meta property="og:locale" content={lang === 'en' ? 'en_GB' : 'pl_PL'} />
	{#if publishedAt}<meta property="article:published_time" content={publishedAt.replace(' ', 'T') + 'Z'} />{/if}
	<meta name="twitter:card" content="summary" />
</svelte:head>
