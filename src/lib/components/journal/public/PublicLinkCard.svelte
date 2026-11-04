<script lang="ts">
	import ExternalLink from 'lucide-svelte/icons/external-link';
	import { m } from '$lib/paraglide/messages.js';
	import type { RenderedMedia } from '$lib/server/journal-media';
	import { linkTypeLabel } from '../journal-ui';

	/** A Biblioteka link inside an article: what it is, who made it and the editor's note; the archive if it broke. */
	let { media, lang }: { media: Extract<RenderedMedia, { type: 'linkcard' }>; lang: 'pl' | 'en' } = $props();
</script>

<a class="linkcard" href={media.url} rel="noopener noreferrer nofollow" target="_blank">
	<span class="kind">{linkTypeLabel(media.media_type, lang)}</span>
	<strong>{media.title}<ExternalLink class="ml-1 inline h-3.5 w-3.5" /></strong>
	<span class="by">{media.artist}</span>
	{#if media.note}<span class="note">{media.note}</span>{/if}
</a>
<p class="print-only">{media.url}</p>
{#if media.broken && media.archive_url}<a class="archive" href={media.archive_url} rel="noopener noreferrer nofollow" target="_blank">{m.pub_archive({}, { locale: lang })}</a>{/if}

<style>
	.linkcard {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		border: 1px solid rgb(63 63 70);
		border-left: 3px solid rgb(251 191 36 / 0.6);
		border-radius: 0.75rem;
		padding: 0.9rem 1.1rem;
		color: rgb(228 228 231);
		text-decoration: none;
	}
	.linkcard:hover {
		border-color: rgb(251 191 36 / 0.6);
	}
	.kind {
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgb(251 191 36 / 0.85);
	}
	.by {
		font-size: 0.8rem;
		color: rgb(161 161 170);
	}
	.note {
		margin-top: 0.3rem;
		font-size: 0.9rem;
		line-height: 1.55;
		color: rgb(212 212 216);
	}
	.archive {
		display: inline-block;
		margin-top: 0.4rem;
		font-size: 0.75rem;
		color: rgb(161 161 170);
	}
</style>
