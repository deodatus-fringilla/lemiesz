<script lang="ts">
	import Folder from 'lucide-svelte/icons/folder';
	import Tag from 'lucide-svelte/icons/tag';
	import { m } from '$lib/paraglide/messages.js';
	import type { MeetingCategory, SpichlerzEntry } from '$lib/server/spichlerz';
	import { CATEGORY_LIST, getCategoryLabel } from './spichlerz-ui';

	let {
		entries,
		allCount,
		letterCount = 0,
		tags,
		activeCategory,
		activeTag,
		activeMode,
		onselectcategory,
		onselecttag
	}: {
		entries: SpichlerzEntry[];
		allCount: number;
		letterCount?: number;
		tags: { tag: string; count: number }[];
		activeCategory: MeetingCategory | 'all';
		activeTag: string | null;
		activeMode: 'task' | 'note' | 'minute' | 'letters' | 'all';
		onselectcategory: (cat: MeetingCategory | 'all') => void;
		onselecttag: (tag: string | null) => void;
	} = $props();

	const countByCategory = $derived((cat: MeetingCategory) =>
		cat === 'epistolary' ? letterCount : entries.filter((e) => e.category === cat).length
	);
	const isFolderActive = $derived((cat: MeetingCategory | 'all') => {
		if (activeMode === 'task' || activeTag) return false;
		if (cat === 'all') return activeMode === 'all';
		if (cat === 'epistolary') return activeMode === 'letters';
		return (activeMode === 'note' || activeMode === 'minute') && activeCategory === cat;
	});
</script>

<aside class="flex flex-col gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
	<!-- Notebooks (Categories) -->
	<div class="space-y-1">
		<div class="px-1.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
			{m.spichlerz_notebooks()}
		</div>
		<button
			type="button"
			onclick={() => onselectcategory('all')}
			class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition {isFolderActive('all')
				? 'bg-zinc-800 font-semibold text-amber-300'
				: 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}"
		>
			<span class="flex items-center gap-2 truncate">
				<Folder class="h-3.5 w-3.5 shrink-0" />
				<span class="truncate">{m.meetings_filter_all()}</span>
			</span>
			<span class="font-mono text-[10px] text-zinc-500">{allCount}</span>
		</button>

		{#each CATEGORY_LIST as cat (cat)}
			<button
				type="button"
				onclick={() => onselectcategory(cat)}
				class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition {isFolderActive(cat)
					? 'bg-zinc-800 font-semibold text-amber-300'
					: 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}"
			>
				<span class="truncate">{getCategoryLabel(cat)}</span>
				<span class="font-mono text-[10px] text-zinc-500">{countByCategory(cat)}</span>
			</button>
		{/each}
	</div>

	<!-- Tag Cloud -->
	{#if tags.length > 0}
		<div class="space-y-1.5 border-t border-zinc-800/80 pt-3">
			<div class="flex items-center gap-1 px-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
				<Tag class="h-3 w-3" />
				<span>{m.spichlerz_tags()}</span>
			</div>
			<div class="flex flex-wrap gap-1">
				{#each tags as t (t.tag)}
					<button
						type="button"
						onclick={() => onselecttag(activeTag === t.tag ? null : t.tag)}
						class="rounded border px-1.5 py-0.5 text-[11px] transition {activeTag === t.tag
							? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
							: 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'}"
					>
						#{t.tag} <span class="text-[9px] text-zinc-500">({t.count})</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</aside>
