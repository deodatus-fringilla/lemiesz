<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import ReviewBadge from '../../ReviewBadge.svelte';
	import { editorContext } from './editor-context';
	import ImageUpload from './ImageUpload.svelte';

	/** The image library (existing studio images and uploads) with search, plus "upload a new one". */
	let { onpick }: { onpick: (id: number) => void } = $props();
	const ctx = editorContext();
	let q = $state('');
	let uploading = $state(false);
	const found = $derived(ctx.images.filter((i) => `${i.title} ${i.artist}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60));
</script>

<div class="space-y-2">
	<div class="flex flex-wrap gap-2">
		<input bind:value={q} placeholder={m.img_search()} class="min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-500/50 focus:outline-none" />
		<button type="button" onclick={() => (uploading = !uploading)} class="rounded border border-amber-500/40 px-2.5 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10">{m.img_new()}</button>
	</div>
	{#if uploading}<ImageUpload locale={ctx.locale} onuploaded={(id) => { uploading = false; onpick(id); }} />{/if}
	<ul class="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
		{#each found as img (img.id)}
			<li>
				<button type="button" onclick={() => onpick(img.id)} class="w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 text-left hover:border-amber-500/50">
					<img src={img.src} alt="" loading="lazy" class="aspect-video w-full bg-zinc-950 object-cover" />
					<span class="block space-y-1 p-1.5">
						<span class="line-clamp-2 block text-[11px] text-zinc-200">{img.title}</span>
						<ReviewBadge state={img.status} />
					</span>
				</button>
			</li>
		{/each}
	</ul>
</div>
