<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import X from 'lucide-svelte/icons/x';
	import { m } from '$lib/paraglide/messages.js';

	/** A window over the page (the browser's own <dialog>: focus stays inside, Esc closes) for picking an image or a source. */
	let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();
	const titleId = $props.id();
	let el: HTMLDialogElement;
	onMount(() => el.showModal());
</script>

<dialog
	bind:this={el}
	aria-labelledby={titleId}
	{onclose}
	onclick={(e) => e.target === el && el.close()}
	class="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-zinc-100 backdrop:bg-black/60"
>
	<div class="mb-3 flex items-center justify-between gap-3">
		<h2 id={titleId} class="text-sm font-semibold">{title}</h2>
		<button type="button" onclick={() => el.close()} class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" aria-label={m.ed_close()}><X class="h-4 w-4" /></button>
	</div>
	{@render children()}
</dialog>
