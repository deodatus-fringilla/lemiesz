<script lang="ts">
	import { marked } from 'marked';
	import Maximize2 from 'lucide-svelte/icons/maximize-2';
	import Minimize2 from 'lucide-svelte/icons/minimize-2';
	import { highlight } from '$lib/actions/highlight';
	import { HitNavigator } from '$lib/actions/hit-navigator.svelte';
	import SpichlerzHitBar from './SpichlerzHitBar.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import type { SpichlerzEntry } from '$lib/server/spichlerz';
	import type { RadarTask } from '$lib/server/spichlerz-tasks';
	import SpichlerzActionItems from './SpichlerzActionItems.svelte';
	import SpichlerzRadar from './SpichlerzRadar.svelte';
	import SpichlerzToolbar from './SpichlerzToolbar.svelte';

	let {
		entry,
		viewMode,
		zenMode,
		tasks,
		searchQuery = '',
		ontogglezen,
		onedit,
		onopenreader,
		onbacktonotes,
		onselectradarentry
	}: {
		entry: SpichlerzEntry | null;
		viewMode: 'note' | 'radar';
		zenMode: boolean;
		searchQuery?: string;
		tasks: RadarTask[];
		ontogglezen: () => void;
		onedit: (entry: SpichlerzEntry) => void;
		onopenreader?: () => void;
		onbacktonotes: () => void;
		onselectradarentry: (entryId: number) => void;
	} = $props();

	const hits = new HitNavigator();
</script>

<section class="flex flex-col gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 sm:p-5">
	{#if viewMode === 'radar'}
		<SpichlerzRadar {tasks} {zenMode} {ontogglezen} onback={onbacktonotes} onselectentry={onselectradarentry} />
	{:else if !entry}
		<div class="rounded-xl border border-dashed border-zinc-800 p-12 text-center text-xs text-zinc-500">
			{m.spichlerz_empty_selection()}
		</div>
	{:else}
		<SpichlerzToolbar {entry} {zenMode} {ontogglezen} {onedit} {onopenreader} />

		<!-- Summary Callout -->
		<div use:highlight={{ query: searchQuery, key: entry.uid }} class="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-zinc-200">
			<strong class="text-amber-400">{m.meetings_summary()}:</strong> {entry.summary}
		</div>

		<!-- Action Items Checklist (for meeting minutes) -->
		{#if entry.entry_type === 'minute'}
			<SpichlerzActionItems entryId={entry.id} entryTitle={entry.title} items={entry.action_items} />
		{:else if entry.key_claims && entry.key_claims.length > 0}
			<!-- Key Claims Chips (for epistolary letters) -->
			<div class="rounded-xl border border-zinc-800/90 bg-zinc-950/70 p-3.5 space-y-2">
				<h4 class="text-xs font-semibold tracking-wider text-amber-400 uppercase">
					Kluczowe tezy z listu ({entry.key_claims.length})
				</h4>
				<div class="flex flex-wrap gap-2">
					{#each entry.key_claims as claim}
						<a
							href="/shield?q={encodeURIComponent(claim.slice(0, 100))}"
							title="Szukaj kontrargumentu w Tarczy"
							class="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-amber-500/50 hover:text-amber-200"
						>
							„{claim}”
						</a>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Full Markdown / Text Body -->
		<SpichlerzHitBar nav={hits} />
		<div use:highlight={{ query: searchQuery, key: entry.uid, scroll: true, nav: hits }} class="prose prose-invert prose-sm max-w-none rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 sm:p-5 leading-relaxed text-zinc-200 break-words whitespace-pre-wrap">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html marked(entry.body)}
		</div>
	{/if}
</section>
