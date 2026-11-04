<script lang="ts">
	import ChevronUp from 'lucide-svelte/icons/chevron-up';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
	import { m } from '$lib/paraglide/messages.js';
	import type { HitNavigator } from '$lib/actions/hit-navigator.svelte';

	let { nav }: { nav: HitNavigator } = $props();
	const btn = 'rounded p-1 text-zinc-300 hover:bg-zinc-800 hover:text-amber-300';
</script>

{#if nav.count > 0}
	<div class="sticky top-0 z-10 -mb-2 flex items-center justify-end gap-1 rounded-lg border border-amber-500/30 bg-zinc-950/95 px-2 py-1 text-xs backdrop-blur" role="group" aria-label={m.hit_counter({ current: nav.index + 1, total: nav.count })}>
		<span class="mr-1 font-mono text-amber-300" aria-live="polite">{m.hit_counter({ current: nav.index + 1, total: nav.count })}</span>
		<button type="button" onclick={() => nav.prev()} title={m.hit_prev()} aria-label={m.hit_prev()} class={btn}><ChevronUp class="h-3.5 w-3.5" /></button>
		<button type="button" onclick={() => nav.next()} title={m.hit_next()} aria-label={m.hit_next()} class={btn}><ChevronDown class="h-3.5 w-3.5" /></button>
	</div>
{/if}
