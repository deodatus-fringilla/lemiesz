<script lang="ts">
	import Hammer from 'lucide-svelte/icons/hammer';
	import Watch from 'lucide-svelte/icons/watch';
	import { m } from '$lib/paraglide/messages.js';
	import type { PublishedSummary } from '$lib/server/journal';
	import type { JournalLang } from '$lib/journal-paths';

	/** A calibre's state at a glance in a collapsed card: its reading time, or a dash while it is unwritten. */
	let { article, caliber, lang }: { article: PublishedSummary | null; caliber: 'light' | 'heavy'; lang: JournalLang } = $props();
	const o = $derived({ locale: lang });
	const name = $derived(caliber === 'heavy' ? m.journal_caliber_heavy({}, o) : m.journal_caliber_light({}, o));
	const tone = $derived(!article ? 'border-zinc-800 text-zinc-600' : caliber === 'heavy' ? 'border-crimson-500/50 bg-crimson-500/15 text-crimson-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-300');
</script>

<span class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap {tone}"
	title="{name}: {article ? m.pub_minutes({ n: article.minutes }, o) : m.pub_in_progress({}, o)}">
	{#if caliber === 'light'}<Hammer class="h-3 w-3" />{:else}<Watch class="h-3 w-3" />{/if}
	{article ? m.pub_minutes_short({ n: article.minutes }, o) : '—'}
</span>
