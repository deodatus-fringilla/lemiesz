<script lang="ts">
	import type { RenderedMedia } from '$lib/server/journal-media';
	import PublicLinkCard from './PublicLinkCard.svelte';
	import PublicPlayer from './PublicPlayer.svelte';

	/** A media block: a click-to-load player or a Biblioteka link card, with an optional caption. */
	let { media, lang }: { media: RenderedMedia; lang: 'pl' | 'en' } = $props();
</script>

<figure class="media">
	{#if media.type === 'embed'}<PublicPlayer {media} {lang} />{:else}<PublicLinkCard {media} {lang} />{/if}
	{#if media.caption}<figcaption>{media.caption}</figcaption>{/if}
</figure>

<style>
	.media {
		margin: 0 0 1.4em;
		font-family: ui-sans-serif, system-ui, sans-serif;
	}
	figcaption {
		margin-top: 0.5em;
		font-size: 0.8rem;
		color: rgb(161 161 170);
	}
</style>
