<script lang="ts">
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import { m } from '$lib/paraglide/messages.js';
	import type { PublishedArticle } from '$lib/server/journal';
	import { articlePath, type JournalLang } from '$lib/journal-paths';

	/** Points from a light article to its heavy twin ("want the full argument?") and back ("in short"). */
	let { twin, lang }: { twin: NonNullable<PublishedArticle['twin']>; lang: JournalLang } = $props();
	const o = $derived({ locale: lang });
</script>

<aside class="rounded-xl border p-4 {twin.caliber === 'heavy' ? 'border-crimson-500/40 bg-crimson-500/10' : 'border-amber-500/30 bg-amber-500/5'}">
	<p class="text-sm text-zinc-300">{twin.caliber === 'heavy' ? m.pub_twin_to_heavy({}, o) : m.pub_twin_to_light({}, o)}</p>
	<a href={articlePath(lang, twin.slug)} class="mt-1 inline-flex items-center gap-1.5 font-semibold text-zinc-50 hover:text-amber-300 {twin.caliber === 'heavy' ? 'font-serif' : ''}">
		{twin.title}<ArrowRight class="h-4 w-4" />
	</a>
</aside>
