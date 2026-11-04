<script lang="ts">
	/**
	 * Rendered article HTML (already sanitised by journal-render.ts) in its calibre's typography:
	 * light = plain and large ("jak budowa cepa"), heavy = serif, precise, with footnote markers ("jak szwajcarski zegarek").
	 */
	let { html, caliber }: { html: string; caliber: 'light' | 'heavy' } = $props();
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<div class="article {caliber}">{@html html}</div>

<style>
	.article {
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
	.article :global(code) {
		font-size: 0.9em;
		color: rgb(212 212 216);
	}
</style>
