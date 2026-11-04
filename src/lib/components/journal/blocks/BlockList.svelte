<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { CitableSource } from '$lib/server/journal-citations';
	import { isEmptyBlock, move, newBlock, type BlockType, type EditorBlock } from './block-utils';
	import AddBlockMenu from './AddBlockMenu.svelte';
	import BlockCard from './BlockCard.svelte';

	/** A list of blocks with "+" between them. Used for the article and, without columns, inside each column. */
	let {
		blocks = $bindable(),
		allowColumns,
		sources,
		locale
	}: { blocks: EditorBlock[]; allowColumns: boolean; sources: CitableSource[]; locale: string } = $props();

	const add = (i: number, t: BlockType) => blocks.splice(i, 0, newBlock(t));
	function remove(i: number) {
		if (!isEmptyBlock(blocks[i]) && !confirm(m.blocks_remove_confirm())) return;
		blocks.splice(i, 1);
	}
</script>

<div class="space-y-1">
	{#if blocks.length === 0}<p class="py-2 text-center text-xs text-zinc-500 italic">{allowColumns ? m.blocks_empty() : m.blocks_column_empty()}</p>{/if}
	{#each blocks as block, i (block._k)}
		<AddBlockMenu {allowColumns} onadd={(t) => add(i, t)} />
		<BlockCard bind:block={blocks[i]} first={i === 0} last={i === blocks.length - 1} {sources} {locale} onmove={(d) => move(blocks, i, i + d)} onremove={() => remove(i)} />
	{/each}
	<AddBlockMenu {allowColumns} always={blocks.length === 0} onadd={(t) => add(blocks.length, t)} />
</div>
