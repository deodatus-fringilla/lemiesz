<script lang="ts">
	import Plus from 'lucide-svelte/icons/plus';
	import CheckSquare from 'lucide-svelte/icons/check-square';
	import Folder from 'lucide-svelte/icons/folder';
	import Tag from 'lucide-svelte/icons/tag';
	import { m } from '$lib/paraglide/messages.js';
	import type { MeetingCategory, SpichlerzEntry } from '$lib/server/spichlerz';
	import { CATEGORY_LIST, getCategoryLabel } from './spichlerz-ui';

	let {
		entries,
		tags,
		activeCategory,
		activeTag,
		viewMode,
		openTasksCount,
		onselectcategory,
		onselecttag,
		ontodoradar,
		onnew
	}: {
		entries: SpichlerzEntry[];
		tags: { tag: string; count: number }[];
		activeCategory: MeetingCategory | 'all';
		activeTag: string | null;
		viewMode: 'note' | 'radar';
		openTasksCount: number;
		onselectcategory: (cat: MeetingCategory | 'all') => void;
		onselecttag: (tag: string | null) => void;
		ontodoradar: () => void;
		onnew: () => void;
	} = $props();

	const countByCategory = $derived((cat: MeetingCategory) =>
		entries.filter((e) => e.category === cat).length
	);
</script>

<aside class="flex flex-col gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
	<!-- Primary Button: New Note -->
	<button
		type="button"
		onclick={onnew}
		class="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-zinc-950 shadow transition hover:bg-amber-400"
	>
		<Plus class="h-4 w-4" />
		<span>{m.spichlerz_new_btn()}</span>
	</button>

	<!-- Global Task Radar Switch -->
	<button
		type="button"
		onclick={ontodoradar}
		class="flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition {viewMode === 'radar'
			? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
			: 'border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'}"
	>
		<!-- Wraps instead of truncating: the sidebar column is only 180px wide on xl screens. -->
		<span class="flex min-w-0 items-center gap-2 text-left leading-tight">
			<CheckSquare class="h-3.5 w-3.5 shrink-0 text-amber-400" />
			<span class="min-w-0 break-words">{m.spichlerz_todo_radar()}</span>
		</span>
		<span class="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
			{openTasksCount}
		</span>
	</button>

	<!-- Notebooks (Categories) -->
	<div class="space-y-1">
		<div class="px-1.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
			{m.spichlerz_notebooks()}
		</div>
		<button
			type="button"
			onclick={() => onselectcategory('all')}
			class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition {viewMode === 'note' && activeCategory === 'all' && !activeTag
				? 'bg-zinc-800 font-semibold text-amber-300'
				: 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}"
		>
			<span class="flex items-center gap-2 truncate">
				<Folder class="h-3.5 w-3.5 shrink-0" />
				<span class="truncate">{m.meetings_filter_all()}</span>
			</span>
			<span class="font-mono text-[10px] text-zinc-500">{entries.length}</span>
		</button>

		{#each CATEGORY_LIST as cat (cat)}
			<button
				type="button"
				onclick={() => onselectcategory(cat)}
				class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition {viewMode === 'note' && activeCategory === cat
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
