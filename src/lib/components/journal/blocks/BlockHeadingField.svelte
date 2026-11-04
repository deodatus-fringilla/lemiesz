<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { HeadingLevel } from '$lib/journal-blocks';

	let { level = $bindable(), text = $bindable(), locale }: { level: HeadingLevel; text: string; locale: string } = $props();
	const sizes: Record<HeadingLevel, string> = { 2: 'text-xl', 3: 'text-lg', 4: 'text-base' };
</script>

<div class="flex flex-wrap gap-2">
	<select bind:value={level} aria-label={m.blocks_heading_level()} class="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm text-zinc-200">
		<option value={2}>{m.blocks_h2()}</option>
		<option value={3}>{m.blocks_h3()}</option>
		<option value={4}>{m.blocks_h4()}</option>
	</select>
	<input bind:value={text} lang={locale} placeholder={m.blocks_placeholder_heading()} class="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-semibold text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none {sizes[level]}" />
</div>
