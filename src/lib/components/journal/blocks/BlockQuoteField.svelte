<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { CitableSource } from '$lib/server/journal-citations';
	import SourcePicker from './SourcePicker.svelte';

	/** A verbatim quotation: only the source is chosen; the text itself always comes from the database. */
	let { sourceId = $bindable(), sources, locale }: { sourceId: number; sources: CitableSource[]; locale: string } = $props();
	const chosen = $derived(sources.find((s) => s.id === sourceId));
	let changing = $state(false);
</script>

{#if sourceId && !changing}
	<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border-l-2 border-crimson-400 bg-zinc-950 px-3 py-2 text-sm">
		<span class="text-zinc-200">{chosen ? `${chosen.work} — ${chosen.section_ref}` : m.blocks_quote_missing({ id: sourceId })}</span>
		<button type="button" onclick={() => (changing = true)} class="text-xs text-amber-300 hover:underline">{m.blocks_quote_change()}</button>
	</div>
	<p class="mt-1 text-[11px] text-zinc-500">{m.blocks_quote_hint()}</p>
{:else}
	<p class="mb-1.5 text-xs text-zinc-400">{m.blocks_quote_pick()}</p>
	<SourcePicker {sources} {locale} needsLocale onpick={(id) => { sourceId = id; changing = false; }} />
{/if}
