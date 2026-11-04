<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { m } from '$lib/paraglide/messages.js';
	import ReviewBadge from '../../ReviewBadge.svelte';
	import { linkTypeLabel } from '../journal-ui';
	import { editorContext } from './editor-context';
	import MediaPicker from './MediaPicker.svelte';

	/** A media block: a player (YouTube/Spotify) or a Biblioteka link card, with an optional caption. */
	let { mediaId = $bindable(), caption = $bindable() }: { mediaId: number; caption?: string } = $props();
	const ctx = editorContext();
	const item = $derived(ctx.media.find((x) => x.id === mediaId));
	let changing = $state(false);
	let error = $state<string | null>(null);

	async function approve() {
		const body = new FormData();
		body.append('mediaId', String(mediaId));
		const r = deserialize(await (await fetch('?/mediaStatus', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } })).text());
		error = r.type === 'success' ? null : m.task_error();
		await invalidateAll();
	}
</script>

{#if item && !changing}
	<div class="space-y-2 text-xs">
		<div class="flex items-start justify-between gap-2 rounded border border-zinc-800 bg-zinc-950 p-2">
			<div class="min-w-0">
				<p class="text-[10px] tracking-wider text-amber-400/80 uppercase">{item.platform === 'web' ? linkTypeLabel(item.media_type) : `${item.platform} · ${m.media_player()}`}</p>
				<p class="font-medium text-zinc-200">{item.title}</p>
				<p class="text-zinc-500">{item.artist}</p>
			</div>
			<div class="flex shrink-0 flex-col items-end gap-1">
				<ReviewBadge state={item.status} />
				<button type="button" onclick={() => (changing = true)} class="text-amber-300 hover:underline">{m.media_change()}</button>
			</div>
		</div>
		{#if item.status !== 'human_approved'}
			<div class="flex flex-wrap items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-2">
				<span class="text-amber-200">{m.media_needs_approval()}</span>
				<button type="button" onclick={approve} class="rounded border border-emerald-500/40 px-2.5 py-1 text-emerald-300 hover:bg-emerald-500/10">{m.media_approve()}</button>
			</div>
		{/if}
		<input bind:value={caption} lang={ctx.locale} placeholder={m.img_caption()} class="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none" />
		{#if error}<p role="alert" class="text-rose-300">{error}</p>{/if}
	</div>
{:else}
	<MediaPicker onpick={(id) => { mediaId = id; changing = false; }} />
{/if}
