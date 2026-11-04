<script lang="ts">
	/**
	 * Rendered article HTML (already sanitised by journal-render.ts) in its calibre's typography:
	 * light = plain and large ("jak budowa cepa"), heavy = serif, precise, with footnote markers ("jak szwajcarski zegarek").
	 */
	import type { RenderedBlock } from '$lib/server/journal-render';
	import PublicBlocks from './PublicBlocks.svelte';
	let { blocks, caliber }: { blocks: RenderedBlock[]; caliber: 'light' | 'heavy' } = $props();
	const hasColumns = $derived(blocks.some((b) => b.type === 'columns'));
</script>

<div class="article {caliber}" class:wide={hasColumns}><PublicBlocks {blocks} /></div>

<style>
	.article {
		/* Columns follow the space this article actually has (page, editor preview), not the window. */
		container-type: inline-size;
		color: rgb(228 228 231);
		overflow-wrap: break-word;
	}
	.article.light {
		font-size: 1.15rem;
		line-height: 1.85;
	}
	.article.heavy {
		font-family: ui-serif, Georgia, Cambria, 'Times New Roman', serif;
		font-size: 1.08rem;
		line-height: 1.8;
	}
	.article :global(p),
	.article :global(ul),
	.article :global(ol),
	.article :global(blockquote) {
		margin: 0 0 1.15em;
	}
	.article :global(h2) {
		margin: 1.8em 0 0.6em;
		font-size: 1.35em;
		font-weight: 700;
		line-height: 1.3;
		color: rgb(250 250 250);
	}
	.article :global(h3) {
		margin: 1.5em 0 0.5em;
		font-size: 1.12em;
		font-weight: 700;
		color: rgb(244 244 245);
	}
	.article.heavy :global(h2),
	.article.heavy :global(h3) {
		font-variant: small-caps;
		letter-spacing: 0.02em;
	}
	.article :global(ul) {
		list-style: disc;
		padding-left: 1.4em;
	}
	.article :global(ol) {
		list-style: decimal;
		padding-left: 1.4em;
	}
	.article :global(li) {
		margin: 0.3em 0;
	}
	.article :global(a) {
		color: rgb(252 211 77);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.article :global(strong) {
		color: rgb(250 250 250);
	}
	.article :global(blockquote) {
		border-left: 3px solid rgb(251 191 36 / 0.6);
		padding: 0.2em 0 0.2em 1em;
		color: rgb(212 212 216);
	}
	.article :global(blockquote.quote) {
		border-left-color: var(--color-crimson-400);
		font-style: italic;
	}
	.article :global(blockquote footer) {
		margin-top: 0.4em;
		font-size: 0.85em;
		font-style: normal;
		color: rgb(161 161 170);
	}
	.article :global(q) {
		font-style: italic;
	}
	.article :global(sup.fn a) {
		margin-left: 0.1em;
		font-size: 0.75em;
		font-family: ui-sans-serif, system-ui, sans-serif;
		text-decoration: none;
		color: var(--color-crimson-300);
	}
	/* Article with columns: the page is wider, but running text keeps a comfortable measure. */
	.article.wide > :global(:not(.cols)) {
		max-width: 68ch;
	}
	.article :global(.cols) {
		display: grid;
		gap: 2rem;
		margin: 0 0 1.15em;
	}
	@container (min-width: 34rem) {
		.article :global(.cols-2) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@container (min-width: 48rem) {
		.article :global(.cols-3) {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.article :global(.col > :last-child) {
		margin-bottom: 0;
	}
	.article :global(h4) {
		margin: 1.3em 0 0.4em;
		font-size: 1em;
		font-weight: 700;
		color: rgb(244 244 245);
	}
	.article.heavy :global(h4) {
		font-variant: small-caps;
	}
	.article :global(hr) {
		/* Aligned with the text (left), not with the wider column area. */
		margin: 2em 0;
		width: 8rem;
		border: 0;
		border-top: 1px solid rgb(63 63 70);
	}
	.article :global(.callout) {
		margin: 0 0 1.15em;
		border: 1px solid rgb(251 191 36 / 0.35);
		border-radius: 0.75rem;
		background: rgb(251 191 36 / 0.06);
		padding: 0.9em 1.1em;
	}
	.article.heavy :global(.callout) {
		border-color: color-mix(in srgb, var(--color-crimson-400) 50%, transparent);
		background: color-mix(in srgb, var(--color-crimson-500) 10%, transparent);
	}
	.article :global(.callout > :last-child) {
		margin-bottom: 0;
	}
	.article :global(code) {
		font-size: 0.9em;
		color: rgb(212 212 216);
	}
</style>
