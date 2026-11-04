<script lang="ts">
	import type { RenderedBlock } from '$lib/server/journal-render';
	import PublicBlocks from './PublicBlocks.svelte';

	/** Draws rendered article blocks; HTML parts are sanitised on the server, headings are plain text. */
	let { blocks }: { blocks: RenderedBlock[] } = $props();
</script>

{#each blocks as b, i (i)}
	{#if b.type === 'html'}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html b.html}
	{:else if b.type === 'heading'}
		<svelte:element this={`h${b.level}`}>{b.text}</svelte:element>
	{:else if b.type === 'callout'}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<aside class="callout">{@html b.html}</aside>
	{:else if b.type === 'separator'}
		<hr />
	{:else if b.type === 'columns'}
		<div class="cols cols-{b.columns.length}">
			{#each b.columns as col, c (c)}<div class="col"><PublicBlocks blocks={col} /></div>{/each}
		</div>
	{/if}
{/each}
