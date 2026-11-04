<script lang="ts">
	import { marked } from 'marked';
	import Maximize2 from 'lucide-svelte/icons/maximize-2';
	import Minimize2 from 'lucide-svelte/icons/minimize-2';
	import { m } from '$lib/paraglide/messages.js';
	import type { ActionItem, SpichlerzEntry } from '$lib/server/spichlerz';
	import SpichlerzActionItems from './SpichlerzActionItems.svelte';
	import SpichlerzToolbar from './SpichlerzToolbar.svelte';

	let {
		entry,
		viewMode,
		zenMode,
		allOpenTasks,
		ontogglezen,
		onedit,
		onopenreader,
		onselectentry
	}: {
		entry: SpichlerzEntry | null;
		viewMode: 'note' | 'radar';
		zenMode: boolean;
		allOpenTasks: { meetingId: number; meetingTitle: string; item: ActionItem; index: number }[];
		ontogglezen: () => void;
		onedit: (entry: SpichlerzEntry) => void;
		onopenreader?: () => void;
		onselectentry: (uid: string) => void;
	} = $props();
</script>

<section class="flex flex-col gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 sm:p-5">
	{#if viewMode === 'radar'}
		<div class="flex items-center justify-between border-b border-zinc-800 pb-3">
			<div>
				<h2 class="text-lg font-bold text-amber-400">{m.spichlerz_todo_radar()}</h2>
				<p class="text-xs text-zinc-400">{m.spichlerz_todo_radar_subtitle()}</p>
			</div>
			<button
				type="button"
				onclick={ontogglezen}
				class="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
			>
				{#if zenMode}<Minimize2 class="h-3.5 w-3.5" />{:else}<Maximize2 class="h-3.5 w-3.5" />{/if}
				<span>{zenMode ? m.spichlerz_zen_exit() : m.spichlerz_zen_enter()}</span>
			</button>
		</div>
		<SpichlerzActionItems
			items={allOpenTasks}
			showAddForm={false}
			onselectentry={(id) => onselectentry(`m-${id}`)}
		/>
	{:else if !entry}
		<div class="rounded-xl border border-dashed border-zinc-800 p-12 text-center text-xs text-zinc-500">
			{m.spichlerz_empty_selection()}
		</div>
	{:else}
		<SpichlerzToolbar {entry} {zenMode} {ontogglezen} {onedit} {onopenreader} />

		<!-- Summary Callout -->
		<div class="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-zinc-200">
			<strong class="text-amber-400">{m.meetings_summary()}:</strong> {entry.summary}
		</div>

		<!-- Action Items Checklist (for meeting minutes) -->
		{#if entry.entry_type === 'minute'}
			<SpichlerzActionItems
				entryId={entry.id}
				items={entry.action_items.map((item, index) => ({ meetingId: entry.id, item, index }))}
			/>
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
		<div class="prose prose-invert prose-sm max-w-none rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 sm:p-5 leading-relaxed text-zinc-200 break-words whitespace-pre-wrap">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html marked(entry.body)}
		</div>
	{/if}
</section>
