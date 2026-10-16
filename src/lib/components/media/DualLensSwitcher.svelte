<script lang="ts">
	import { BookOpen, Shield } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';

	let {
		activeLayer = $bindable('allegory'),
		onToggle
	}: {
		activeLayer?: 'allegory' | 'realism';
		onToggle?: (layer: 'allegory' | 'realism') => void;
	} = $props();

	function select(layer: 'allegory' | 'realism') {
		activeLayer = layer;
		onToggle?.(layer);
	}
</script>

<div class="inline-flex items-center rounded-xl border border-zinc-700/80 bg-zinc-950/80 p-1 shadow-inner backdrop-blur" role="group" aria-label={m.series_dual_lens_prompt()}>
	<button
		type="button"
		class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 {activeLayer === 'allegory'
			? 'bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/40'
			: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}"
		aria-pressed={activeLayer === 'allegory'}
		onclick={() => select('allegory')}
	>
		<BookOpen class="h-3.5 w-3.5" />
		<span>{m.series_layer_allegory()}</span>
	</button>

	<button
		type="button"
		class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 {activeLayer === 'realism'
			? 'bg-amber-500/20 text-amber-300 shadow-sm border border-amber-500/40'
			: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}"
		aria-pressed={activeLayer === 'realism'}
		onclick={() => select('realism')}
	>
		<Shield class="h-3.5 w-3.5" />
		<span>{m.series_layer_realism()}</span>
	</button>
</div>
