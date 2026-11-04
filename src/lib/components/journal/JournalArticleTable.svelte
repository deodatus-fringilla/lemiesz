<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { EditorRow } from '$lib/server/journal';
	import { groupEditorRows } from '$lib/journal-pairs';
	import JournalVersionCell from './JournalVersionCell.svelte';

	/** The back-office list: one row per rozprawe and language, with its light and heavy version side by side. */
	let { articles }: { articles: EditorRow[] } = $props();
	const rows = $derived(groupEditorRows(articles));
</script>

{#if rows.length === 0}
	<p class="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">{m.journal_empty()}</p>
{:else}
	<ul class="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
		{#each rows as r (r.key)}
			<li class="space-y-2 px-4 py-3">
				<div class="flex items-baseline gap-3">
					<span class="min-w-0 flex-1 font-serif text-base font-semibold text-zinc-100">{(r.heavy ?? r.light)?.title}</span>
					<span class="font-mono text-[11px] text-zinc-500 uppercase">{r.locale}</span>
				</div>
				<div class="grid gap-2 md:grid-cols-2">
					<JournalVersionCell row={r.light} caliber="light" />
					<JournalVersionCell row={r.heavy} caliber="heavy" />
				</div>
			</li>
		{/each}
	</ul>
{/if}
