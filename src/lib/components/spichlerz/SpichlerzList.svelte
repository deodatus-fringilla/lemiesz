<script lang="ts">
	import Search from 'lucide-svelte/icons/search';
	import Pin from 'lucide-svelte/icons/pin';
	import Clock from 'lucide-svelte/icons/clock';
	import X from 'lucide-svelte/icons/x';
	import { m } from '$lib/paraglide/messages.js';
	import type { SpichlerzEntry } from '$lib/server/spichlerz';
	import SpichlerzCard from './SpichlerzCard.svelte';

	let {
		entries,
		selectedUid,
		searchQuery,
		activeTag,
		onsearchchange,
		oncleartag,
		onselect
	}: {
		entries: SpichlerzEntry[];
		selectedUid: string | null;
		searchQuery: string;
		activeTag: string | null;
		onsearchchange: (q: string) => void;
		oncleartag: () => void;
		onselect: (uid: string) => void;
	} = $props();

	const pinnedEntries = $derived(entries.filter((e) => e.is_pinned));
	const unpinnedEntries = $derived(entries.filter((e) => !e.is_pinned));
</script>

<section class="flex flex-col gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 xl:max-h-[calc(100dvh-var(--header-height,4rem)-2rem)]">
	<!-- Search Input (FTS5 server + live filter) -->
	<form method="GET" action="/spichlerz" class="relative shrink-0">
		<Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
		<input
			type="search"
			name="q"
			value={searchQuery}
			oninput={(e) => onsearchchange((e.currentTarget as HTMLInputElement).value)}
			placeholder={m.spichlerz_search_placeholder()}
			class="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
		/>
	</form>

	{#if activeTag}
		<div class="flex shrink-0 items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
			<span>Tag: <strong>#{activeTag}</strong></span>
			<button type="button" onclick={oncleartag} class="hover:text-white">
				<X class="h-3.5 w-3.5" />
			</button>
		</div>
	{/if}

	{#if entries.length === 0}
		<div class="rounded-lg border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">
			{m.meetings_empty()}
		</div>
	{:else}
		<div class="space-y-4 overflow-y-auto max-h-[calc(100dvh-260px)] pr-1 xl:max-h-none xl:min-h-0 xl:flex-1">
			{#if pinnedEntries.length > 0}
				<div class="space-y-2">
					<div class="flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-wider text-amber-400/90 uppercase">
						<Pin class="h-3 w-3" />
						<span>{m.spichlerz_pinned()} ({pinnedEntries.length})</span>
					</div>
					{#each pinnedEntries as entry (entry.uid)}
						<SpichlerzCard {entry} selected={selectedUid === entry.uid} {onselect} />
					{/each}
				</div>
			{/if}

			{#if unpinnedEntries.length > 0}
				<div class="space-y-2">
					<div class="flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
						<Clock class="h-3 w-3" />
						<span>{m.spichlerz_all_entries()} ({unpinnedEntries.length})</span>
					</div>
					{#each unpinnedEntries as entry (entry.uid)}
						<SpichlerzCard {entry} selected={selectedUid === entry.uid} {onselect} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</section>
