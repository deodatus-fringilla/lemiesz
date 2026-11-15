<script lang="ts">
	import Archive from 'lucide-svelte/icons/archive';
	import { m } from '$lib/paraglide/messages.js';
	import type { MeetingCategory, SpichlerzEntry } from '$lib/server/spichlerz';
	import SpichlerzQuickCapture from '$lib/components/spichlerz/SpichlerzQuickCapture.svelte';
	import SpichlerzLayout from '$lib/components/spichlerz/SpichlerzLayout.svelte';
	import SpichlerzSidebar from '$lib/components/spichlerz/SpichlerzSidebar.svelte';
	import SpichlerzList from '$lib/components/spichlerz/SpichlerzList.svelte';
	import SpichlerzWorkspace from '$lib/components/spichlerz/SpichlerzWorkspace.svelte';
	import LetterReader from '$lib/components/letters/LetterReader.svelte';
	import { fetchThreadLetters, type ReaderLetter } from '$lib/components/letters/letter-reader';
	import SpichlerzEditorModal from '$lib/components/spichlerz/SpichlerzEditorModal.svelte';

	let { data, form } = $props();

	let activeCategory = $state<MeetingCategory | 'all'>('all');
	let activeTag = $state<string | null>(null);
	let searchQuery = $state('');
	let selectedUidOverride = $state<string | null>(null);
	let activeMode = $state<'task' | 'note' | 'minute' | 'letters' | 'all'>('minute');
	let zenMode = $state(false);
	let mobileTab = $state<'notebooks' | 'list' | 'workspace'>('workspace');
	let modalOpen = $state(false);
	let readerLetters = $state<ReaderLetter[] | null>(null);
	let editingEntry = $state<SpichlerzEntry | null>(null);
	let draftTitle = $state('');

	const viewMode = $derived<'note' | 'radar'>(activeMode === 'task' ? 'radar' : 'note');

	$effect(() => {
		activeCategory = data.activeCategory;
		activeTag = data.activeTag;
		searchQuery = data.searchQuery;
	});

	const allEntries = $derived(data.entries.filter((e) => !e.is_backlog));
	const letterEntries = $derived(allEntries.filter((e) => e.entry_type === 'letter'));
	const nonLetterEntries = $derived(allEntries.filter((e) => e.entry_type !== 'letter'));

	const modeEntries = $derived(
		nonLetterEntries.filter((e) => (activeMode === 'note' ? e.entry_kind === 'note' : e.entry_kind === 'minute'))
	);

	const visibleEntries = $derived(
		activeMode === 'all' ? allEntries : activeMode === 'letters' ? letterEntries : modeEntries
	);

	const filteredEntries = $derived(
		visibleEntries.filter((e) => {
			if (activeMode !== 'all' && activeMode !== 'letters' && activeCategory !== 'all' && e.category !== activeCategory)
				return false;
			if (activeTag && !(e.tags || '').toLowerCase().includes(activeTag.toLowerCase())) return false;
			if (!searchQuery.trim()) return true;
			const hay = `${e.title} ${e.summary} ${e.body} ${e.tags || ''} ${JSON.stringify(e.action_items)}`.toLowerCase();
			return hay.includes(searchQuery.toLowerCase());
		})
	);

	const selectedUid = $derived(selectedUidOverride ?? data.selectedUid ?? filteredEntries[0]?.uid ?? null);
	const activeEntry = $derived(filteredEntries.find((e) => e.uid === selectedUid) ?? filteredEntries[0] ?? null);
	/** Letter texts are fetched only when the reader opens, not with every page load. */
	async function openReader() {
		if (!activeEntry?.thread_id) return;
		try {
			readerLetters = await fetchThreadLetters(activeEntry.thread_id);
		} catch {
			alert(m.task_error());
		}
	}
	const openTasksCount = $derived(data.tasks.filter((t) => t.item.status === 'pending').length);
</script>

<svelte:head><title>{m.spichlerz_title()} · {m.app_title()}</title></svelte:head>

<div class="space-y-4">
	<div class="flex flex-col gap-1">
		<h1 class="flex items-center gap-2.5 text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
			<Archive class="h-6 w-6 text-amber-400" />
			<span>{m.spichlerz_title()}</span>
		</h1>
		<p class="text-xs text-zinc-400">{m.spichlerz_subtitle()}</p>
	</div>

	{#if form?.error}
		<div class="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{form.error}</div>
	{/if}

	<SpichlerzQuickCapture
		{activeMode}
		{openTasksCount}
		onmodechange={(mode) => {
			activeMode = mode;
			activeCategory = 'all';
			activeTag = null;
			if (mode === 'task') mobileTab = 'workspace';
		}}
		onnewminute={(title) => { editingEntry = null; draftTitle = title; modalOpen = true; }}
	/>

	<SpichlerzLayout {zenMode} {mobileTab} radarMode={viewMode === 'radar'} entriesCount={filteredEntries.length} onmobiletab={(t) => { mobileTab = t; if (t === 'list' && activeMode === 'task') activeMode = 'minute'; }}>
		{#snippet sidebar()}
			<SpichlerzSidebar
				entries={activeMode === 'note' || activeMode === 'minute' ? modeEntries : nonLetterEntries}
				allCount={allEntries.length}
				letterCount={letterEntries.length}
				tags={data.tags}
				{activeCategory}
				{activeTag}
				{activeMode}
				onselectcategory={(cat) => {
					activeTag = null;
					if (cat === 'all') {
						activeMode = 'all';
						activeCategory = 'all';
					} else if (cat === 'epistolary') {
						activeMode = 'letters';
						activeCategory = 'epistolary';
					} else {
						activeCategory = cat;
						if (activeMode === 'task' || activeMode === 'letters' || activeMode === 'all') activeMode = 'minute';
					}
					mobileTab = 'list';
				}}
				onselecttag={(t) => { activeTag = t; activeCategory = 'all'; activeMode = 'all'; mobileTab = 'list'; }}
			/>
		{/snippet}
		{#snippet list()}
			<SpichlerzList
				entries={filteredEntries} selectedUid={activeEntry?.uid ?? null} {searchQuery} {activeTag}
				onsearchchange={(q) => (searchQuery = q)} oncleartag={() => (activeTag = null)}
				onselect={(uid) => { selectedUidOverride = uid; if (activeMode === 'task') activeMode = 'minute'; mobileTab = 'workspace'; }}
			/>
		{/snippet}
		{#snippet workspace()}
			<SpichlerzWorkspace
				entry={activeEntry} {viewMode} {zenMode} tasks={data.tasks} {searchQuery}
				ontogglezen={() => (zenMode = !zenMode)}
				onedit={(e) => { editingEntry = e; modalOpen = true; }}
				onopenreader={activeEntry?.entry_type === 'letter' ? openReader : undefined}
				onselectradarentry={(id) => {
					const target = data.entries.find((e) => e.id === id && e.entry_type === 'minute');
					activeMode = target?.entry_kind === 'note' ? 'note' : 'minute';
					selectedUidOverride = `m-${id}`;
					mobileTab = 'workspace';
				}}
			/>
		{/snippet}
	</SpichlerzLayout>
</div>

{#if readerLetters && activeEntry?.entry_type === 'letter'}
	<LetterReader letters={readerLetters} initialLetterId={activeEntry.id} highlight={searchQuery} title={activeEntry.thread_title ?? ''} onclose={() => (readerLetters = null)} />
{/if}

<SpichlerzEditorModal open={modalOpen} {editingEntry} initialTitle={draftTitle} threads={data.threads} letters={data.letters} mediaList={data.mediaList} sourcesList={data.sourcesList} onclose={() => { modalOpen = false; draftTitle = ''; }} />
