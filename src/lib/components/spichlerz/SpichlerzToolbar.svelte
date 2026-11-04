<script lang="ts">
	import { enhance } from '$app/forms';
	import Pin from 'lucide-svelte/icons/pin';
	import Edit2 from 'lucide-svelte/icons/edit-2';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import Maximize2 from 'lucide-svelte/icons/maximize-2';
	import Minimize2 from 'lucide-svelte/icons/minimize-2';
	import Link2 from 'lucide-svelte/icons/link-2';
	import Flame from 'lucide-svelte/icons/flame';
	import BookOpen from 'lucide-svelte/icons/book-open';
	import PenLine from 'lucide-svelte/icons/pen-line';
	import Users from 'lucide-svelte/icons/users';
	import Calendar from 'lucide-svelte/icons/calendar';
	import Mail from 'lucide-svelte/icons/mail';
	import Inbox from 'lucide-svelte/icons/inbox';
	import Shield from 'lucide-svelte/icons/shield';
	import { m } from '$lib/paraglide/messages.js';
	import type { SpichlerzEntry } from '$lib/server/spichlerz';
	import { CATEGORY_BADGE_STYLES, COLOR_BORDER_STYLES, COLOR_DOT_STYLES, COLOR_TAGS, getCategoryLabel } from './spichlerz-ui';

	let {
		entry,
		zenMode,
		ontogglezen,
		onedit
	}: {
		entry: SpichlerzEntry;
		zenMode: boolean;
		ontogglezen: () => void;
		onedit: (entry: SpichlerzEntry) => void;
	} = $props();
</script>

<div class="flex flex-col gap-3 border-b border-zinc-800/80 pb-3 border-l-4 pl-3 {COLOR_BORDER_STYLES[entry.color_tag]}">
	<!-- Top Bar: Metadata Badges + Action Controls -->
	<div class="flex flex-wrap items-center justify-between gap-2.5">
		<div class="flex flex-wrap items-center gap-1.5 text-xs">
			<span class="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-zinc-300 whitespace-nowrap">
				<Calendar class="h-3 w-3 text-zinc-400 shrink-0" />
				{entry.meeting_date}
			</span>
			{#if entry.entry_type === 'letter'}
				<span class="inline-flex items-center gap-1 rounded border px-2 py-0.5 font-semibold text-xs whitespace-nowrap {entry.letter_direction === 'outbound' ? 'border-crimson-500/40 bg-crimson-500/20 text-crimson-300' : 'border-sky-500/40 bg-sky-500/20 text-sky-300'}">
					{#if entry.letter_direction === 'outbound'}
						<Mail class="h-3 w-3 shrink-0" />
						<span>Tura #{entry.letter_turn} · Wychodzący do Posła Brauna</span>
					{:else}
						<Inbox class="h-3 w-3 shrink-0" />
						<span>Tura #{entry.letter_turn} · Odpowiedź Biura Brauna</span>
					{/if}
				</span>
			{:else}
				<span class="rounded border px-2 py-0.5 font-medium whitespace-nowrap {CATEGORY_BADGE_STYLES[entry.category]}">
					{getCategoryLabel(entry.category)}
				</span>
			{/if}
			{#if entry.attendees}
				<span class="inline-flex items-center gap-1 text-zinc-400 truncate max-w-[240px]" title={entry.attendees}>
					<Users class="h-3 w-3 shrink-0" />
					<span class="truncate">{entry.attendees}</span>
				</span>
			{/if}
		</div>

		<!-- Action Controls -->
		<div class="flex flex-wrap items-center gap-1.5 shrink-0 ml-auto">
			{#if entry.entry_type === 'minute'}
				<form method="POST" action="?/togglePin" use:enhance>
					<input type="hidden" name="id" value={entry.id} />
					<button
						type="submit"
						title={entry.is_pinned ? m.spichlerz_unpin() : m.spichlerz_pin()}
						class="rounded-lg border p-1.5 text-xs transition {entry.is_pinned
							? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
							: 'border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:text-zinc-100'}"
					>
						<Pin class="h-3.5 w-3.5" />
					</button>
				</form>

				<div class="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-1.5 py-1">
					{#each COLOR_TAGS as c (c)}
						<form method="POST" action="?/setColor" use:enhance>
							<input type="hidden" name="id" value={entry.id} />
							<input type="hidden" name="color_tag" value={c} />
							<button
								type="submit"
								aria-label={c}
								class="h-3 w-3 rounded-full transition {COLOR_DOT_STYLES[c]} {entry.color_tag === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}"
							></button>
						</form>
					{/each}
				</div>
			{/if}

			<button
				type="button"
				onclick={ontogglezen}
				class="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
			>
				{#if zenMode}<Minimize2 class="h-3.5 w-3.5" />{:else}<Maximize2 class="h-3.5 w-3.5" />{/if}
				<span class="hidden sm:inline">{zenMode ? m.spichlerz_zen_exit() : m.spichlerz_zen_enter()}</span>
			</button>

			{#if entry.entry_type === 'minute'}
				<button
					type="button"
					onclick={() => onedit(entry)}
					class="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
				>
					<Edit2 class="h-3.5 w-3.5" />
					<span>{m.meetings_edit()}</span>
				</button>

				<form
					method="POST"
					action="?/delete"
					use:enhance
					onsubmit={(e) => !confirm(m.meetings_delete_confirm()) && e.preventDefault()}
				>
					<input type="hidden" name="id" value={entry.id} />
					<button
						type="submit"
						class="rounded-lg border border-rose-500/25 bg-rose-500/10 p-1.5 text-xs text-rose-300 hover:bg-rose-500/20"
						title={m.meetings_delete()}
					>
						<Trash2 class="h-3.5 w-3.5" />
					</button>
				</form>
			{:else}
				<a
					href="/shield?tab=dossier"
					class="inline-flex items-center gap-1 rounded-lg border border-crimson-500/40 bg-crimson-500/10 px-2.5 py-1 text-xs font-semibold text-crimson-300 hover:bg-crimson-500/20 whitespace-nowrap"
				>
					<Shield class="h-3.5 w-3.5" />
					<span>{m.spichlerz_open_dossier()}</span>
				</a>
			{/if}
		</div>
	</div>

	<!-- Title: Full width, normal line wrapping -->
	<h2 class="text-lg sm:text-xl font-bold text-zinc-100 leading-snug break-words">{entry.title}</h2>
</div>

<!-- Canonical Links & Bridge Strip -->
<div class="flex flex-wrap items-center gap-2 text-xs">
	{#if entry.thread_title}
		<a href="/shield?tab=dossier" class="inline-flex items-center gap-1.5 rounded-lg border border-crimson-500/30 bg-crimson-500/10 px-2.5 py-1 text-crimson-300 hover:underline">
			<Link2 class="h-3.5 w-3.5" />
			<span>{entry.thread_title} {entry.letter_turn ? `(#${entry.letter_turn})` : ''}</span>
		</a>
	{/if}
	{#if entry.letter_filename}
		<span class="rounded bg-zinc-800 px-2 py-1 font-mono text-[11px] text-zinc-400">
			{entry.letter_filename}
		</span>
	{/if}
	{#if entry.media_title}
		<a href={entry.kuznia_id ? `/kuznia?id=${entry.kuznia_id}` : '/media'} class="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-300 hover:underline">
			<Flame class="h-3.5 w-3.5" />
			<span>{entry.media_title} ({entry.media_artist})</span>
		</a>
	{/if}
	{#if entry.source_ref}
		<a href="/repository" class="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-blue-300 hover:underline">
			<BookOpen class="h-3.5 w-3.5" />
			<span>{entry.source_ref}</span>
		</a>
	{/if}
	<a
		href="/content?topic={encodeURIComponent(entry.title + ': ' + entry.summary)}"
		class="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/70 px-2.5 py-1 text-zinc-300 hover:border-amber-500/40 hover:text-amber-300"
	>
		<PenLine class="h-3.5 w-3.5" />
		<span>{m.spichlerz_bridge_content()}</span>
	</a>
</div>
