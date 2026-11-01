<script lang="ts">
	import { enhance } from '$app/forms';
	import X from 'lucide-svelte/icons/x';
	import { m } from '$lib/paraglide/messages.js';
	import type { ColorTag, SpichlerzEntry } from '$lib/server/spichlerz';
	import { CATEGORY_LIST, COLOR_DOT_STYLES, COLOR_TAGS, getCategoryLabel } from './spichlerz-ui';

	let {
		open,
		editingEntry,
		threads,
		letters,
		mediaList,
		sourcesList,
		onclose
	}: {
		open: boolean;
		editingEntry: SpichlerzEntry | null;
		threads: { id: number; title: string; interlocutor: string }[];
		letters: { id: number; thread_id: number; turn_number: number; direction: string; date_label: string }[];
		mediaList: { id: number; title: string; artist_or_author: string }[];
		sourcesList: { id: number; work: string; section_ref: string }[];
		onclose: () => void;
	} = $props();

	let selectedThreadId = $state<number | null>(null);
	let selectedColor = $state<ColorTag>('zinc');

	$effect(() => {
		selectedThreadId = editingEntry?.thread_id ?? null;
		selectedColor = editingEntry?.color_tag ?? 'zinc';
	});

	const filteredLetters = $derived(
		selectedThreadId ? letters.filter((l) => l.thread_id === Number(selectedThreadId)) : []
	);
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs overflow-y-auto">
		<div class="my-8 w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
			<div class="flex items-center justify-between border-b border-zinc-800 pb-3">
				<h2 class="text-lg font-bold text-zinc-100">{editingEntry ? m.meetings_edit() : m.spichlerz_new_btn()}</h2>
				<button type="button" onclick={onclose} class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
					<X class="h-5 w-5" />
				</button>
			</div>

			<form
				method="POST"
				action={editingEntry ? '?/update' : '?/create'}
				use:enhance={() => async ({ result, update }) => {
					await update();
					if (result.type === 'success') onclose();
				}}
				class="mt-4 space-y-3 text-xs"
			>
				{#if editingEntry}<input type="hidden" name="id" value={editingEntry.id} />{/if}
				<input type="hidden" name="color_tag" value={selectedColor} />

				<div class="grid gap-3 sm:grid-cols-3">
					<div class="sm:col-span-2 space-y-1">
						<label for="sp-title" class="font-medium text-zinc-300">Tytuł wpisu *</label>
						<input id="sp-title" name="title" value={editingEntry?.title ?? ''} required class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-zinc-100 focus:border-amber-500 focus:outline-none" />
					</div>
					<div class="space-y-1">
						<label for="sp-cat" class="font-medium text-zinc-300">Przegroda</label>
						<select id="sp-cat" name="category" value={editingEntry?.category ?? 'general'} class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-zinc-100">
							{#each CATEGORY_LIST as cat (cat)}<option value={cat}>{getCategoryLabel(cat)}</option>{/each}
						</select>
					</div>
				</div>

				<div class="grid gap-3 sm:grid-cols-3 items-center">
					<div class="space-y-1">
						<label for="sp-date" class="font-medium text-zinc-300">Data</label>
						<input id="sp-date" type="date" name="meeting_date" value={editingEntry?.meeting_date ?? new Date().toISOString().slice(0, 10)} class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-zinc-100" />
					</div>
					<div class="space-y-1">
						<label for="sp-att" class="font-medium text-zinc-300">{m.meetings_attendees()}</label>
						<input id="sp-att" name="attendees" value={editingEntry?.attendees ?? 'Bogdan Zięba, Zespół'} class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-zinc-100" />
					</div>
					<div class="flex items-center justify-between gap-2 pt-4">
						<label class="inline-flex items-center gap-1.5 text-zinc-300 cursor-pointer">
							<input type="checkbox" name="is_pinned" value="1" checked={editingEntry?.is_pinned ?? false} class="rounded border-zinc-700 bg-zinc-950 text-amber-500" />
							<span>{m.spichlerz_pinned()}</span>
						</label>
						<div class="flex items-center gap-1">
							{#each COLOR_TAGS as c (c)}
								<button type="button" aria-label={c} onclick={() => (selectedColor = c)} class="h-3.5 w-3.5 rounded-full {COLOR_DOT_STYLES[c]} {selectedColor === c ? 'ring-2 ring-white' : 'opacity-50'}"></button>
							{/each}
						</div>
					</div>
				</div>

				<div class="grid gap-2 sm:grid-cols-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5">
					<select name="thread_id" bind:value={selectedThreadId} class="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200">
						<option value={null}>{m.meetings_none_thread()}</option>
						{#each threads as th (th.id)}<option value={th.id}>{th.title} ({th.interlocutor})</option>{/each}
					</select>
					<select name="after_letter_id" value={editingEntry?.after_letter_id ?? null} disabled={!selectedThreadId} class="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200 disabled:opacity-40">
						<option value={null}>{m.meetings_none_letter()}</option>
						{#each filteredLetters as l (l.id)}<option value={l.id}>#{l.turn_number} ({l.date_label})</option>{/each}
					</select>
					<select name="media_id" value={editingEntry?.media_id ?? null} class="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200">
						<option value={null}>{m.spichlerz_none_media()}</option>
						{#each mediaList as ma (ma.id)}<option value={ma.id}>{ma.title} — {ma.artist_or_author}</option>{/each}
					</select>
					<select name="source_id" value={editingEntry?.source_id ?? null} class="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200">
						<option value={null}>{m.spichlerz_none_source()}</option>
						{#each sourcesList as src (src.id)}<option value={src.id}>{src.work} {src.section_ref}</option>{/each}
					</select>
				</div>

				<div class="space-y-1">
					<label for="sp-sum" class="font-medium text-zinc-300">{m.meetings_summary()}</label>
					<textarea id="sp-sum" name="summary" rows="2" value={editingEntry?.summary ?? ''} class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-zinc-100"></textarea>
				</div>
				<div class="space-y-1">
					<label for="sp-body" class="font-medium text-zinc-300">{m.meetings_body()} *</label>
					<textarea id="sp-body" name="body" rows="6" required value={editingEntry?.body ?? ''} class="w-full font-mono rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-zinc-100"></textarea>
				</div>
				<div class="space-y-1">
					<label for="sp-tags" class="font-medium text-zinc-300">{m.meetings_tags()}</label>
					<input id="sp-tags" name="tags" value={editingEntry?.tags ?? ''} placeholder="braun, korona, retencja, korowod" class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-zinc-100" />
				</div>
				<div class="flex justify-end gap-2 border-t border-zinc-800 pt-3">
					<button type="button" onclick={onclose} class="rounded-lg border border-zinc-700 px-3.5 py-1.5 text-zinc-300 hover:bg-zinc-800">{m.meetings_cancel()}</button>
					<button type="submit" class="rounded-lg bg-amber-500 px-4 py-1.5 font-semibold text-zinc-950 hover:bg-amber-400">{m.meetings_save()}</button>
				</div>
			</form>
		</div>
	</div>
{/if}
