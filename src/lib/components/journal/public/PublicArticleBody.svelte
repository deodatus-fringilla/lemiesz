<script lang="ts">
	/**
	 * Rendered article HTML (already sanitised by journal-render.ts) in its calibre's typography:
	 * light = plain and large ("jak budowa cepa"), heavy = serif, precise, with footnote markers ("jak szwajcarski zegarek").
	 */
	import type { RenderedBlock } from '$lib/server/journal-render';
	import PublicBlocks from './PublicBlocks.svelte';
	/**
	 * `breakout`: "full" images span the whole screen (public page only; in the editor's preview they stay inside).
	 * `columns`: 2 lets the text flow from a first column into a second (magazine layout) where there is room for it.
	 */
	let { blocks, caliber, breakout = false, lang = 'pl', columns = 1 }: { blocks: RenderedBlock[]; caliber: 'light' | 'heavy'; breakout?: boolean; lang?: 'pl' | 'en'; columns?: 1 | 2 } = $props();
	const wide = $derived(columns === 2 || blocks.some((b) => b.type === 'image' && b.size !== 'column'));
</script>

<div class="article {caliber}" class:wide class:breakout><div class="flow" class:cols2={columns === 2}><PublicBlocks {blocks} {lang} /></div></div>

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
	/* A wide article (wide images): the page is wider, but running text keeps a comfortable measure. */
	.article.wide .flow:not(.cols2) > :global(:not(.img-wide):not(.img-full)) {
		max-width: 68ch;
	}
	.article :global(figure.img) {
		margin: 0 0 1.4em;
	}
	.article :global(figure.img img) {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.5rem;
		background: rgb(24 24 27);
	}
	.article.breakout :global(figure.img-full) {
		width: 100vw;
		margin-left: calc(50% - 50vw);
	}
	.article.breakout :global(figure.img-full img) {
		border-radius: 0;
	}
	.article :global(figcaption) {
		margin-top: 0.5em;
		font-family: ui-sans-serif, system-ui, sans-serif;
		font-size: 0.8rem;
		line-height: 1.5;
		color: rgb(161 161 170);
	}
	.article.breakout :global(figure.img-full figcaption) {
		padding: 0 1rem;
	}
	.article :global(figcaption .credit) {
		display: block;
		color: rgb(113 113 122);
	}
	/* Images written into text by the article editor: left or right, with the text flowing around them. */
	.article {
		display: flow-root;
	}
	.article :global(figure.img-left),
	.article :global(figure.img-right) {
		width: 45%;
		margin-top: 0.3em;
		margin-bottom: 0.9em;
	}
	.article :global(figure.img-left) {
		float: left;
		margin-right: 1.4em;
	}
	.article :global(figure.img-right) {
		float: right;
		margin-left: 1.4em;
	}
	/* Where the article is narrow, an image is as wide as the text instead. */
	@container (max-width: 34rem) {
		.article :global(figure.img-left),
		.article :global(figure.img-right) {
			float: none;
			width: auto;
			margin-inline: 0;
		}
	}
	/* A quotation or highlight next to a floated image sits beside it instead of running under it. */
	.article :global(blockquote),
	.article :global(.callout) {
		display: flow-root;
	}
	.article :global(table) {
		display: block;
		overflow-x: auto;
		margin: 0 0 1.15em;
		border-collapse: collapse;
		font-size: 0.92em;
	}
	.article :global(th),
	.article :global(td) {
		border: 1px solid rgb(63 63 70);
		padding: 0.4em 0.7em;
		text-align: left;
		vertical-align: top;
	}
	.article :global(th) {
		background: rgb(39 39 42);
		color: rgb(250 250 250);
	}
	.article :global(pre) {
		overflow-x: auto;
		margin: 0 0 1.15em;
		border-radius: 0.5rem;
		background: rgb(24 24 27);
		padding: 0.8em 1em;
		font-size: 0.88em;
	}
	.article :global(pre code) {
		font-size: inherit;
	}
	/* Two columns: one text that flows from the first column into the second, where the article is wide enough. */
	@container (min-width: 40rem) {
		.flow.cols2 {
			column-count: 2;
			column-gap: 2.5rem;
			column-rule: 1px solid rgb(63 63 70);
		}
		/* Both columns start at the same height: the first block has no top margin. */
		.flow.cols2 > :global(:first-child) {
			margin-top: 0;
		}
		.flow.cols2 > :global(p) {
			orphans: 2;
			widows: 2;
		}
		.flow.cols2 > :global(h2),
		.flow.cols2 > :global(h3),
		.flow.cols2 > :global(h4) {
			break-after: avoid;
		}
		.flow.cols2 :global(figure),
		.flow.cols2 :global(blockquote),
		.flow.cols2 :global(.callout),
		.flow.cols2 :global(li) {
			break-inside: avoid;
		}
		.flow.cols2 > :global(figure.img-wide),
		.flow.cols2 > :global(figure.img-full) {
			column-span: all;
		}
		/* Inside a column, an image written into the text is as wide as the column instead of floating. */
		.flow.cols2 :global(figure.img-left),
		.flow.cols2 :global(figure.img-right) {
			float: none;
			width: auto;
			margin-inline: 0;
		}
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
