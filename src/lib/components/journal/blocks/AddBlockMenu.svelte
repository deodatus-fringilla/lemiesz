<script lang="ts">
	import Plus from 'lucide-svelte/icons/plus';
	import { m } from '$lib/paraglide/messages.js';
	import type { BlockType } from './block-utils';
	import { blockLabel } from './labels';

	/** The "+" between blocks: opens the list of block types. Columns are offered only at the top level. */
	let { allowColumns, onadd, always = false }: { allowColumns: boolean; onadd: (t: BlockType) => void; always?: boolean } = $props();
	let open = $state(false);
	const types = $derived<BlockType[]>(['text', 'heading', ...(allowColumns ? (['columns'] as BlockType[]) : []), 'image', 'media', 'quote', 'callout', 'separator']);
</script>

<div class="group relative flex items-center justify-center py-1 {always ? '' : 'opacity-50 hover:opacity-100 focus-within:opacity-100'}">
	{#if open}
		<div class="flex flex-wrap justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 p-2">
			{#each types as t (t)}
				<button type="button" onclick={() => { open = false; onadd(t); }} class="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:border-amber-500/50 hover:text-amber-300">{blockLabel(t)}</button>
			{/each}
			<button type="button" onclick={() => (open = false)} class="px-2 text-xs text-zinc-500 hover:text-zinc-300">{m.journal_cancel()}</button>
		</div>
	{:else}
		<button type="button" onclick={() => (open = true)} aria-label={m.blocks_add()} title={m.blocks_add()} class="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-zinc-700 px-3 py-0.5 text-xs text-zinc-400 hover:border-amber-500/50 hover:text-amber-300">
			<Plus class="h-3.5 w-3.5" />{m.blocks_add()}
		</button>
	{/if}
</div>
