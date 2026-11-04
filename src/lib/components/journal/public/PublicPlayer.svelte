<script lang="ts">
	import Play from 'lucide-svelte/icons/play';
	import { m } from '$lib/paraglide/messages.js';
	import type { RenderedMedia } from '$lib/server/journal-media';

	/**
	 * A player behind a click: until the reader presses play nothing is loaded from YouTube or Spotify (no cookies, no
	 * IP address shared). The iframe takes the record's derived privacy-host embed_url only (ROBOT-09).
	 */
	let { media, lang }: { media: Extract<RenderedMedia, { type: 'embed' }>; lang: 'pl' | 'en' } = $props();
	const o = $derived({ locale: lang });
	let playing = $state(false);
	const provider = $derived(media.provider === 'youtube' ? 'YouTube' : 'Spotify');
</script>

<!-- On paper a player is useless: print what it is and where to find it. -->
<p class="print-only">▶ {media.title}, {media.artist}: {media.url}</p>
{#if playing}
	<iframe
		src={media.embed_url}
		title={media.title}
		class="player {media.provider === 'youtube' ? 'video' : media.tall ? 'audio-tall' : 'audio'}"
		allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
		referrerpolicy="strict-origin-when-cross-origin"
		allowfullscreen
	></iframe>
{:else}
	<button type="button" class="facade {media.provider === 'youtube' ? 'video' : 'audio'}" onclick={() => (playing = true)} aria-label={m.pub_media_play({ title: media.title }, o)}>
		<span class="play"><Play class="h-6 w-6" /></span>
		<span class="who"><strong>{media.title}</strong><span>{media.artist}</span></span>
		<span class="notice">{m.pub_media_notice({ provider }, o)}</span>
	</button>
{/if}

<style>
	.player {
		display: flex;
		width: 100%;
		border: 1px solid rgb(63 63 70);
		border-radius: 0.75rem;
	}
	.player {
		border: 0;
	}
	.video {
		aspect-ratio: 16 / 9;
	}
	.audio {
		height: 152px;
	}
	.audio-tall {
		height: 352px;
	}
	.facade {
		position: relative;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 1rem;
		background: linear-gradient(135deg, rgb(24 24 27), rgb(9 9 11));
		color: rgb(228 228 231);
		cursor: pointer;
		text-align: center;
	}
	.facade.audio {
		flex-direction: row;
		justify-content: flex-start;
		text-align: left;
	}
	.facade:focus-visible .play {
		background: rgb(251 191 36);
		color: rgb(9 9 11);
	}
	.play {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3.25rem;
		height: 3.25rem;
		flex-shrink: 0;
		border-radius: 9999px;
		background: rgb(251 191 36 / 0.15);
		color: rgb(252 211 77);
		transition: background 0.15s;
	}
	.who {
		display: flex;
		flex-direction: column;
		font-size: 0.95rem;
	}
	.who span {
		font-size: 0.8rem;
		color: rgb(161 161 170);
	}
	.notice {
		font-size: 0.7rem;
		color: rgb(113 113 122);
	}
	.facade.audio .notice {
		margin-left: auto;
		max-width: 14rem;
	}
	@media print {
		.facade .notice,
		.play {
			display: none;
		}
	}
</style>
