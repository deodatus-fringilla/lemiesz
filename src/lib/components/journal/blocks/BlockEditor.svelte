<script lang="ts">
	import { untrack } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { m } from '$lib/paraglide/messages.js';
	import type { Block, LayoutColumns } from '$lib/journal-blocks';
	import type { CitableSource } from '$lib/server/journal-citations';
	import { toJson, withKeys } from './block-utils';
	import BlockList from './BlockList.svelte';
	import BlockPreview from './BlockPreview.svelte';
	import { setEditorContext } from './editor-context';
	import type { JournalImage } from '$lib/server/journal-images';
	import type { EditorMedia } from '$lib/server/journal-media';

	/**
	 * The journal's only article editor. Blocks live here until saved; the surrounding form posts them as `blocks`.
	 * `dirty` tells the page there are unsaved changes (approving approves the SAVED version, never these edits).
	 */
	let {
		initial,
		initialColumns = 1,
		locale,
		caliber,
		sources,
		images = [],
		media = [],
		dirty = $bindable(false),
		wide = $bindable(false)
	}: { initial: Block[]; initialColumns?: LayoutColumns; locale: string; caliber: 'light' | 'heavy'; sources: CitableSource[]; images?: JournalImage[]; media?: EditorMedia[]; dirty?: boolean; wide?: boolean } = $props();
	setEditorContext({
		get images() {
			return images;
		},
		get media() {
			return media;
		},
		get locale() {
			return locale;
		}
	});

	let blocks = $state(withKeys(untrack(() => initial)));
	// Reactive on purpose: after Save the editor's text is usually identical, so only this change re-checks `dirty`.
	let savedJson = $state(untrack(() => JSON.stringify(initial)));
	// The layout (one column or two) belongs to the whole text and is saved with it, like the blocks.
	let columns = $state<LayoutColumns>(untrack(() => initialColumns));
	let savedColumns = $state<LayoutColumns>(untrack(() => initialColumns));
	let mode = $state<'edit' | 'preview' | 'split'>('edit');
	const json = $derived(toJson(blocks));
	// Tells the page that editor and preview sit side by side, so it can give them the full width.
	// Two columns need room: the preview alone then takes the page's full width too.
	$effect(() => {
		wide = mode === 'split' || (mode === 'preview' && columns === 2);
	});

	// A new saved version (after Save) replaces the editor's copy; other reloads (approve, flag) keep unsaved edits.
	$effect(() => {
		const incoming = JSON.stringify(initial);
		if (incoming !== savedJson) {
			savedJson = incoming;
			blocks = withKeys(initial);
		}
	});
	$effect(() => {
		if (initialColumns !== savedColumns) {
			savedColumns = initialColumns;
			columns = initialColumns;
		}
	});
	$effect(() => {
		dirty = json !== savedJson || columns !== savedColumns;
	});
	$effect(() => {
		if (!dirty) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	});
	// beforeunload covers closing the tab; in-app links (language tabs, menu, "back") need SvelteKit's own guard.
	beforeNavigate((nav) => {
		if (dirty && nav.type !== 'leave' && !confirm(m.blocks_leave_confirm())) nav.cancel();
	});
	const tab = (on: boolean) => `rounded-md px-3 py-1 font-medium transition ${on ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'}`;
</script>

<input type="hidden" name="blocks" value={json} />
<input type="hidden" name="columns" value={columns} />
<div class="space-y-3">
	<div class="flex flex-wrap items-center gap-3">
		<div class="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-xs" role="tablist">
			<button type="button" role="tab" aria-selected={mode === 'edit'} class={tab(mode === 'edit')} onclick={() => (mode = 'edit')}>{m.blocks_mode_edit()}</button>
			<button type="button" role="tab" aria-selected={mode === 'preview'} class={tab(mode === 'preview')} onclick={() => (mode = 'preview')}>{m.blocks_mode_preview()}</button>
			<button type="button" role="tab" aria-selected={mode === 'split'} class="{tab(mode === 'split')} hidden lg:inline-block" onclick={() => (mode = 'split')}>{m.blocks_mode_split()}</button>
		</div>
		<div class="inline-flex items-center gap-2 text-xs text-zinc-400">
			{m.blocks_layout()}
			<div class="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5" role="radiogroup" aria-label={m.blocks_layout()}>
				<button type="button" role="radio" aria-checked={columns === 1} class={tab(columns === 1)} onclick={() => (columns = 1)}>{m.blocks_layout_one()}</button>
				<button type="button" role="radio" aria-checked={columns === 2} class={tab(columns === 2)} onclick={() => (columns = 2)} title={m.blocks_layout_two_hint()}>{m.blocks_layout_two()}</button>
			</div>
		</div>
		{#if columns === 2 && mode === 'split'}<span class="text-xs text-zinc-500">{m.blocks_layout_split_hint()}</span>{/if}
		{#if dirty}<span class="text-xs text-amber-300">● {m.blocks_unsaved()}</span>{/if}
	</div>
	<div class={mode === 'split' ? 'grid gap-4 lg:grid-cols-2' : ''}>
		{#if mode !== 'preview'}<BlockList bind:blocks {sources} {locale} />{/if}
		{#if mode !== 'edit'}<div class={mode === 'split' ? 'lg:sticky lg:top-24 lg:self-start' : ''}><BlockPreview {json} {locale} {caliber} {columns} /></div>{/if}
	</div>
</div>
