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
		onmobiletab,
		sidebar,
		list,
		workspace
	}: {
		zenMode: boolean;
		mobileTab: 'notebooks' | 'list' | 'workspace';
		entriesCount: number;
		onmobiletab: (tab: 'notebooks' | 'list' | 'workspace') => void;
		sidebar: Snippet;
		list: Snippet;
		workspace: Snippet;
	} = $props();
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
		: 'grid-cols-1 xl:grid-cols-[180px_250px_minmax(0,1fr)] 2xl:grid-cols-[200px_300px_minmax(0,1fr)]'}"
>
	{#if !zenMode}
		<div class={mobileTab === 'notebooks' ? 'block' : 'hidden xl:block'}>
			{@render sidebar()}
		</div>
		<div class={mobileTab === 'list' ? 'block' : 'hidden xl:block'}>
			{@render list()}
		</div>
	{/if}
	<div class={zenMode || mobileTab === 'workspace' ? 'block min-w-0' : 'hidden xl:block min-w-0'}>
		{@render workspace()}
	</div>
</div>
