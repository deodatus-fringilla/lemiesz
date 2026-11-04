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
	let viewMode = $state<'note' | 'radar'>('note');
	let zenMode = $state(false);
	let mobileTab = $state<'notebooks' | 'list' | 'workspace'>('workspace');
	let modalOpen = $state(false);
	let readerLetters = $state<ReaderLetter[] | null>(null);
	let editingEntry = $state<SpichlerzEntry | null>(null);

	$effect(() => {
		activeCategory = data.activeCategory;
		activeTag = data.activeTag;
		searchQuery = data.searchQuery;
	});

	const filteredEntries = $derived(
		data.entries.filter((e) => {
			if (activeCategory !== 'all' && e.category !== activeCategory) return false;
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

	<SpichlerzQuickCapture />

	<SpichlerzLayout {zenMode} {mobileTab} radarMode={viewMode === 'radar'} entriesCount={filteredEntries.length} onmobiletab={(t) => { mobileTab = t; if (t === 'list') viewMode = 'note'; }}>
		{#snippet sidebar()}
			<SpichlerzSidebar
				entries={data.entries} tags={data.tags} {activeCategory} {activeTag} {viewMode}
				{openTasksCount}
				onselectcategory={(cat) => { activeCategory = cat; activeTag = null; viewMode = 'note'; mobileTab = 'list'; }}
				onselecttag={(t) => { activeTag = t; activeCategory = 'all'; viewMode = 'note'; mobileTab = 'list'; }}
				ontodoradar={() => { viewMode = 'radar'; mobileTab = 'workspace'; }}
				onnew={() => { editingEntry = null; modalOpen = true; }}
			/>
		{/snippet}
		{#snippet list()}
			<SpichlerzList
				entries={filteredEntries} selectedUid={activeEntry?.uid ?? null} {searchQuery} {activeTag}
				onsearchchange={(q) => (searchQuery = q)} oncleartag={() => (activeTag = null)}
				onselect={(uid) => { selectedUidOverride = uid; viewMode = 'note'; mobileTab = 'workspace'; }}
			/>
		{/snippet}
		{#snippet workspace()}
			<SpichlerzWorkspace
				entry={activeEntry} {viewMode} {zenMode} tasks={data.tasks} {searchQuery}
				ontogglezen={() => (zenMode = !zenMode)}
				onedit={(e) => { editingEntry = e; modalOpen = true; }}
				onopenreader={activeEntry?.entry_type === 'letter' ? openReader : undefined}
				onbacktonotes={() => (viewMode = 'note')}
				onselectradarentry={(id) => { selectedUidOverride = `m-${id}`; viewMode = 'note'; mobileTab = 'workspace'; }}
			/>
		{/snippet}
	</SpichlerzLayout>
</div>

{#if readerLetters && activeEntry?.entry_type === 'letter'}
	<LetterReader letters={readerLetters} initialLetterId={activeEntry.id} highlight={searchQuery} title={activeEntry.thread_title ?? ''} onclose={() => (readerLetters = null)} />
{/if}

<SpichlerzEditorModal open={modalOpen} {editingEntry} threads={data.threads} letters={data.letters} mediaList={data.mediaList} sourcesList={data.sourcesList} onclose={() => (modalOpen = false)} />
