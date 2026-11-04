<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { PublishedArticle } from '$lib/server/journal';
	import { articlePath, type JournalLang } from '$lib/journal-paths';
	import JournalCaliberBadge from '../JournalCaliberBadge.svelte';

	let { article, lang, showCaliber = false }: { article: PublishedArticle; lang: JournalLang; showCaliber?: boolean } = $props();
</script>

<article class="group">
	<a href={articlePath(lang, article.slug)} class="block space-y-1.5 py-3">
		{#if showCaliber}<JournalCaliberBadge caliber={article.caliber} {lang} />{/if}
		<h3 class="text-lg leading-snug font-semibold text-zinc-100 transition group-hover:text-amber-300 {article.caliber === 'heavy' ? 'font-serif' : ''}">{article.title}</h3>
		{#if article.lead}<p class="text-sm leading-relaxed text-zinc-400">{article.lead}</p>{/if}
		<p class="text-xs text-zinc-500">
			{article.author ?? m.pub_editorial({}, { locale: lang })} · {article.published_at.slice(0, 10)}
		</p>
	</a>
</article>
