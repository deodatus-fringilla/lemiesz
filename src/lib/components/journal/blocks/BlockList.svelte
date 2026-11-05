<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { CitableSource } from '$lib/server/journal-citations';
	import { isEmptyBlock, move, newBlock, type BlockType, type EditorBlock } from './block-utils';
	import AddBlockMenu from './AddBlockMenu.svelte';
	import BlockCard from './BlockCard.svelte';

	/** The article's blocks as cards, with "+" between them. */
	let { blocks = $bindable(), sources, locale }: { blocks: EditorBlock[]; sources: CitableSource[]; locale: string } = $props();

	const add = (i: number, t: BlockType) => blocks.splice(i, 0, newBlock(t));
	function remove(i: number) {
		if (!isEmptyBlock(blocks[i]) && !confirm(m.blocks_remove_confirm())) return;
		blocks.splice(i, 1);
	}
</script>

<div class="space-y-1">
	{#if blocks.length === 0}<p class="py-2 text-center text-xs text-zinc-500 italic">{m.blocks_empty()}</p>{/if}
	{#each blocks as block, i (block._k)}
		<AddBlockMenu onadd={(t) => add(i, t)} />
		<BlockCard bind:block={blocks[i]} first={i === 0} last={i === blocks.length - 1} {sources} {locale} onmove={(d) => move(blocks, i, i + d)} onremove={() => remove(i)} />
	{/each}
	<AddBlockMenu always={blocks.length === 0} onadd={(t) => add(blocks.length, t)} />
</div>
