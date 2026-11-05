<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { EditorRow } from '$lib/server/journal';
	import { groupEditorRows } from '$lib/journal-pairs';
	import JournalRozprawaItem from './JournalRozprawaItem.svelte';

	/** The back-office list: an accordion with one item per rozprawe and language; the most recently changed one is open. */
	let { articles }: { articles: EditorRow[] } = $props();
	const rows = $derived(groupEditorRows(articles));
</script>

{#if rows.length === 0}
	<p class="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">{m.journal_empty()}</p>
{:else}
	<div class="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
		{#each rows as r, i (r.key)}<JournalRozprawaItem pair={r} open={i === 0} />{/each}
	</div>
{/if}
