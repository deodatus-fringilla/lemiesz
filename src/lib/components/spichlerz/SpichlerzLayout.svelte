<script lang="ts">
	import type { Snippet } from 'svelte';
	import Folder from 'lucide-svelte/icons/folder';
	import List from 'lucide-svelte/icons/list';
	import BookOpen from 'lucide-svelte/icons/book-open';
	import { m } from '$lib/paraglide/messages.js';

	let {
		zenMode,
		mobileTab = 'workspace',
		entriesCount = 0,
		radarMode = false,
		onmobiletab,
		sidebar,
		list,
		workspace
	}: {
		zenMode: boolean;
		mobileTab: 'notebooks' | 'list' | 'workspace';
		entriesCount: number;
		radarMode?: boolean;
		onmobiletab: (tab: 'notebooks' | 'list' | 'workspace') => void;
		sidebar: Snippet;
		list: Snippet;
		workspace: Snippet;
	} = $props();

	// On xl each column is pinned below the sticky app header and scrolls on its own,
	// so scrolling one panel never drags the other two.
	const stick = 'xl:sticky xl:top-[calc(var(--header-height,4rem)+1rem)]';
	const pane = `${stick} xl:max-h-[calc(100dvh-var(--header-height,4rem)-2rem)] xl:overflow-y-auto xl:overscroll-contain`;
	// The list column does not scroll as a whole: its search box stays put and only the results scroll.
</script>

<!-- Mobile / Tablet View Switcher (<xl) -->
<div class="flex rounded-xl border border-zinc-800 bg-zinc-900/70 p-1 text-xs xl:hidden">
	<button
		type="button"
		onclick={() => onmobiletab('notebooks')}
		class="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition {mobileTab === 'notebooks'
			? 'bg-amber-500/20 text-amber-300'
			: 'text-zinc-400 hover:text-zinc-200'}"
	>
		<Folder class="h-3.5 w-3.5" />
		<span>{m.spichlerz_tab_notebooks()}</span>
	</button>
	<button
		type="button"
		onclick={() => onmobiletab('list')}
		class="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition {mobileTab === 'list'
			? 'bg-amber-500/20 text-amber-300'
			: 'text-zinc-400 hover:text-zinc-200'}"
	>
		<List class="h-3.5 w-3.5" />
		<span>{m.spichlerz_tab_list({ count: entriesCount })}</span>
	</button>
	<button
		type="button"
		onclick={() => onmobiletab('workspace')}
		class="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition {mobileTab === 'workspace'
			? 'bg-amber-500/20 text-amber-300'
			: 'text-zinc-400 hover:text-zinc-200'}"
	>
		<BookOpen class="h-3.5 w-3.5" />
		<span>{m.spichlerz_tab_workspace()}</span>
	</button>
</div>

<!-- 3-Panel Responsive Grid (Respects +layout.svelte xl:pr-72 & supports Zen Mode) -->
<div
	class="grid items-start gap-4 {zenMode
		? 'grid-cols-1'
		: radarMode
			? 'grid-cols-1 xl:grid-cols-[180px_minmax(0,1fr)] 2xl:grid-cols-[200px_minmax(0,1fr)]'
			: 'grid-cols-1 xl:grid-cols-[180px_250px_minmax(0,1fr)] 2xl:grid-cols-[200px_300px_minmax(0,1fr)]'}"
>
	{#if !zenMode}
		<div class="{mobileTab === 'notebooks' ? 'block' : 'hidden xl:block'} {pane}">
			{@render sidebar()}
		</div>
		{#if !radarMode}
			<div class="{mobileTab === 'list' ? 'block' : 'hidden xl:block'} {stick}">
				{@render list()}
			</div>
		{/if}
	{/if}
	<div class="{zenMode || mobileTab === 'workspace' ? 'block' : 'hidden xl:block'} min-w-0 {pane}">
		{@render workspace()}
	</div>
</div>
