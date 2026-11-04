<script lang="ts">
	import ArrowUp from 'lucide-svelte/icons/arrow-up';
	import ArrowDown from 'lucide-svelte/icons/arrow-down';
	import X from 'lucide-svelte/icons/x';
	import { m } from '$lib/paraglide/messages.js';
	import type { CitableSource } from '$lib/server/journal-citations';
	import type { EditorBlock } from './block-utils';
	import { blockLabel } from './labels';
	import BlockColumnsField from './BlockColumnsField.svelte';
	import BlockHeadingField from './BlockHeadingField.svelte';
	import BlockImageField from './BlockImageField.svelte';
	import BlockQuoteField from './BlockQuoteField.svelte';
	import BlockTextField from './BlockTextField.svelte';

	/** One block as a card: its type, move up/down, remove, and the fields for its type. */
	let {
		block = $bindable(),
		first,
		last,
		sources,
		locale,
		onmove,
		onremove
	}: {
		block: EditorBlock;
		first: boolean;
		last: boolean;
		sources: CitableSource[];
		locale: string;
		onmove: (dir: -1 | 1) => void;
		onremove: () => void;
	} = $props();
	const btn = 'rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent';
</script>

<section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 {block.type === 'columns' ? 'border-dashed' : ''}">
	<header class="mb-2 flex items-center justify-between gap-2">
		<span class="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">{blockLabel(block.type)}</span>
		<span class="flex gap-0.5">
			<button type="button" class={btn} disabled={first} onclick={() => onmove(-1)} title={m.blocks_move_up()} aria-label={m.blocks_move_up()}><ArrowUp class="h-3.5 w-3.5" /></button>
			<button type="button" class={btn} disabled={last} onclick={() => onmove(1)} title={m.blocks_move_down()} aria-label={m.blocks_move_down()}><ArrowDown class="h-3.5 w-3.5" /></button>
			<button type="button" class="{btn} hover:text-rose-300" onclick={onremove} title={m.blocks_remove()} aria-label={m.blocks_remove()}><X class="h-3.5 w-3.5" /></button>
		</span>
	</header>
	{#if block.type === 'text' || block.type === 'callout'}
		<BlockTextField bind:value={block.md} kind={block.type} {sources} {locale} />
	{:else if block.type === 'heading'}
		<BlockHeadingField bind:level={block.level} bind:text={block.text} {locale} />
	{:else if block.type === 'quote'}
		<BlockQuoteField bind:sourceId={block.sourceId} {sources} {locale} />
	{:else if block.type === 'image'}
		<BlockImageField bind:imageId={block.imageId} bind:size={block.size} bind:caption={block.caption} />
	{:else if block.type === 'separator'}
		<hr class="mx-auto my-2 w-32 border-zinc-700" />
	{:else if block.type === 'columns'}
		<BlockColumnsField bind:block {sources} {locale} />
	{/if}
</section>
