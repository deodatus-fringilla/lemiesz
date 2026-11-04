<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import ReviewBadge from '../../ReviewBadge.svelte';
	import { linkTypeLabel } from '../journal-ui';
	import { editorContext } from './editor-context';

	/** The media library (players and Biblioteka links) with search. New items are added in Media or Biblioteka. */
	let { onpick }: { onpick: (id: number) => void } = $props();
	const ctx = editorContext();
	let q = $state('');
	const found = $derived(ctx.media.filter((x) => `${x.title} ${x.artist} ${x.media_type}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60));
</script>

<div class="space-y-2">
	<input bind:value={q} placeholder={m.media_search()} class="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-500/50 focus:outline-none" />
	{#if ctx.media.length === 0}<p class="text-xs text-zinc-500">{m.media_none()}</p>{/if}
	<ul class="max-h-72 space-y-1 overflow-y-auto">
		{#each found as x (x.id)}
			<li>
				<button type="button" onclick={() => onpick(x.id)} class="flex w-full items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-left text-xs hover:border-amber-500/50">
					<span class="w-20 shrink-0 text-[10px] tracking-wider text-amber-400/80 uppercase">{x.platform === 'web' ? linkTypeLabel(x.media_type) : x.platform}</span>
					<span class="min-w-0 flex-1"><span class="block truncate text-zinc-200">{x.title}</span><span class="block truncate text-zinc-500">{x.artist}</span></span>
					<ReviewBadge state={x.status} />
				</button>
			</li>
		{/each}
	</ul>
	<p class="text-[11px] text-zinc-500">{m.media_where_to_add()}</p>
</div>
