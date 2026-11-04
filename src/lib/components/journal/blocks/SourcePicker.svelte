<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { CitableSource } from '$lib/server/journal-citations';

	/** Searchable list of approved sources. For a verbatim quotation the source needs approved text in this language. */
	let {
		sources,
		locale,
		needsLocale = false,
		onpick
	}: { sources: CitableSource[]; locale: string; needsLocale?: boolean; onpick: (id: number) => void } = $props();

	let q = $state('');
	const found = $derived(
		sources.filter((s) => `${s.work} ${s.section_ref} ${s.id}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40)
	);
</script>

<div class="space-y-1.5 rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-xs">
	{#if sources.length === 0}
		<p class="p-1 text-zinc-400">{m.blocks_source_none()}</p>
	{:else}
		<!-- svelte-ignore a11y_autofocus -->
		<input bind:value={q} autofocus placeholder={m.blocks_source_search()} class="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-100 focus:border-amber-500/50 focus:outline-none" />
		<ul class="max-h-56 overflow-y-auto">
			{#each found as s (s.id)}
				{@const usable = !needsLocale || s.locales.includes(locale)}
				<li>
					<button type="button" disabled={!usable} onclick={() => onpick(s.id)} class="w-full rounded px-2 py-1 text-left hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">
						<span class="font-mono text-zinc-500">#{s.id}</span> <span class="text-zinc-200">{s.work}</span> <span class="text-zinc-400">— {s.section_ref}</span>
						{#if !usable}<span class="block text-rose-300/80">{m.blocks_source_no_locale({ lang: locale.toUpperCase() })}</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
