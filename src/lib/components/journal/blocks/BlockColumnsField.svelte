<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { CitableSource } from '$lib/server/journal-citations';
	import { setColumnCount, type EditorColumns } from './block-utils';
	import BlockList from './BlockList.svelte';

	/** 2 or 3 columns, each its own list of blocks (no columns inside columns). They stack on phones for readers. */
	let { block = $bindable(), sources, locale }: { block: EditorColumns; sources: CitableSource[]; locale: string } = $props();
</script>

<label class="mb-2 inline-flex items-center gap-2 text-xs text-zinc-400">
	{m.blocks_columns_count()}
	<select value={block.columns.length} onchange={(e) => setColumnCount(block, Number(e.currentTarget.value))} class="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-200">
		<option value={2}>2</option>
		<option value={3}>3</option>
	</select>
</label>
<!-- Side by side only when this field is wide enough; otherwise one under another (readers see the real layout in the preview). -->
<div class="@container">
<div class="grid gap-3 {block.columns.length === 3 ? '@3xl:grid-cols-3' : '@xl:grid-cols-2'}">
	{#each block.columns as _, c (c)}
		<div class="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2">
			<p class="mb-1 text-[11px] text-zinc-500">{m.blocks_column_n({ n: c + 1 })}</p>
			<BlockList bind:blocks={block.columns[c]} allowColumns={false} {sources} {locale} />
		</div>
	{/each}
</div>
</div>
