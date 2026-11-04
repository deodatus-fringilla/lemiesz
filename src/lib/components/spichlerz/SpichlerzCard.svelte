<script lang="ts">
	import Pin from 'lucide-svelte/icons/pin';
	import CheckSquare from 'lucide-svelte/icons/check-square';
	import Link2 from 'lucide-svelte/icons/link-2';
	import Music from 'lucide-svelte/icons/music';
	import BookOpen from 'lucide-svelte/icons/book-open';
	import Mail from 'lucide-svelte/icons/mail';
	import Inbox from 'lucide-svelte/icons/inbox';
	import { m } from '$lib/paraglide/messages.js';
	import type { SpichlerzEntry } from '$lib/server/spichlerz';
	import { CATEGORY_BADGE_STYLES, COLOR_BORDER_STYLES, getCategoryLabel } from './spichlerz-ui';

	let {
		entry,
		selected,
		onselect
	}: {
		entry: SpichlerzEntry;
		selected: boolean;
		onselect: (uid: string) => void;
	} = $props();

	const doneCount = $derived(entry.action_items.filter((a) => a.status === 'done').length);
	const totalCount = $derived(entry.action_items.length);
</script>

<button
	type="button"
	onclick={() => onselect(entry.uid)}
	class="w-full text-left rounded-lg border border-l-4 p-3 transition {COLOR_BORDER_STYLES[entry.color_tag]} {selected
		? 'border-amber-500/50 bg-amber-500/10 shadow-sm'
		: 'border-zinc-800/80 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900'}"
>
	<div class="flex items-center justify-between gap-1.5 text-[11px] text-zinc-400">
		<div class="flex items-center gap-1.5 min-w-0">
			{#if entry.is_pinned}
				<Pin class="h-3 w-3 shrink-0 text-amber-400" />
			{/if}
			{#if entry.entry_type === 'letter'}
				<span
					class="inline-flex items-center gap-1 rounded border px-1.5 py-0.2 text-[10px] font-semibold {entry.letter_direction ===
					'outbound'
						? 'border-crimson-500/40 bg-crimson-500/20 text-crimson-300'
						: 'border-sky-500/40 bg-sky-500/20 text-sky-300'}"
				>
					{#if entry.letter_direction === 'outbound'}
						<Mail class="h-2.5 w-2.5" />
						<span>List #{entry.letter_turn}</span>
					{:else}
						<Inbox class="h-2.5 w-2.5" />
						<span>Odp. Biura #{entry.letter_turn}</span>
					{/if}
				</span>
			{:else}
				<span class="rounded border px-1.5 py-0.2 text-[10px] font-medium {CATEGORY_BADGE_STYLES[entry.category]}">
					{getCategoryLabel(entry.category)}
				</span>
			{/if}
		</div>
		<span class="shrink-0 font-mono text-[10px] text-zinc-500">{entry.meeting_date}</span>
	</div>

	<h4 class="mt-1.5 line-clamp-2 text-xs font-bold leading-snug text-zinc-100">
		{entry.title}
	</h4>

	<p class="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
		{entry.summary}
	</p>

	<!-- Bottom Meta Row: Tasks & Links -->
	{#if totalCount > 0 || entry.thread_title || entry.media_title || entry.source_ref}
		<div class="mt-2 flex flex-wrap items-center gap-2 border-t border-zinc-800/60 pt-1.5 text-[10px] text-zinc-400">
			{#if totalCount > 0}
				<span class="inline-flex items-center gap-1 {doneCount === totalCount ? 'text-emerald-400' : 'text-amber-300'}">
					<CheckSquare class="h-3 w-3" />
					{m.spichlerz_tasks_count({ done: doneCount, total: totalCount })}
				</span>
			{/if}
			{#if entry.thread_title && entry.entry_type !== 'letter'}
				<span class="inline-flex items-center gap-0.5 text-crimson-300 truncate max-w-[130px]">
					<Link2 class="h-2.5 w-2.5 shrink-0" />
					<span class="truncate">{entry.thread_title}</span>
				</span>
			{/if}
			{#if entry.media_title}
				<span class="inline-flex items-center gap-0.5 text-amber-300 truncate max-w-[130px]">
					<Music class="h-2.5 w-2.5 shrink-0" />
					<span class="truncate">{entry.media_title}</span>
				</span>
			{/if}
			{#if entry.source_ref}
				<span class="inline-flex items-center gap-0.5 text-blue-300 truncate max-w-[130px]">
					<BookOpen class="h-2.5 w-2.5 shrink-0" />
					<span class="truncate">{entry.source_ref}</span>
				</span>
			{/if}
		</div>
	{/if}
</button>
