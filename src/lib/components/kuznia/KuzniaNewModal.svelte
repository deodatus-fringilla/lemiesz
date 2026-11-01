<script lang="ts">
	import X from 'lucide-svelte/icons/x';
	import Plus from 'lucide-svelte/icons/plus';
	import Music from 'lucide-svelte/icons/music';
	import BookOpen from 'lucide-svelte/icons/book-open';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		open: boolean;
		mediaList: Array<{ id: number; title: string; artist_or_author: string; media_type: string }>;
		sourcesList: Array<{ id: number; work: string; section_ref: string }>;
		onclose: () => void;
	}

	let { open, mediaList, sourcesList, onclose }: Props = $props();

	let itemType = $state<'media' | 'source'>('media');
	let title = $state('');
	let keyQuote = $state('');

	function onSelect(e: Event, isSource: boolean) {
		const id = Number((e.target as HTMLSelectElement).value);
		if (isSource) {
			const s = sourcesList.find((x) => x.id === id);
			if (s && !title) title = `${s.work} (${s.section_ref})`;
		} else {
			const med = mediaList.find((x) => x.id === id);
			if (med && !title) title = `${med.artist_or_author ? med.artist_or_author + ' — ' : ''}„${med.title}”`;
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
		<div class="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl space-y-4">
			<div class="flex items-center justify-between border-b border-zinc-800 pb-3">
				<h3 class="text-base font-bold text-zinc-100 flex items-center gap-2">
					<Plus class="size-4 text-amber-500" />
					<span>{m.kuznia_new_deliberation()}</span>
				</h3>
				<button type="button" onclick={onclose} class="text-zinc-400 hover:text-zinc-200 cursor-pointer">
					<X class="size-5" />
				</button>
			</div>

			<form method="POST" action="?/createDeliberation" class="space-y-4">
				<div class="flex gap-2 text-xs">
					<button
						type="button"
						onclick={() => (itemType = 'media')}
						class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md py-2 font-medium border cursor-pointer {itemType === 'media'
							? 'bg-amber-600/30 text-amber-200 border-amber-500/50'
							: 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-800'}"
					>
						<Music class="size-3.5" />
						<span>Media / Utwór</span>
					</button>
					<button
						type="button"
						onclick={() => (itemType = 'source')}
						class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md py-2 font-medium border cursor-pointer {itemType === 'source'
							? 'bg-amber-600/30 text-amber-200 border-amber-500/50'
							: 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-800'}"
					>
						<BookOpen class="size-3.5" />
						<span>Pismo / Traktat</span>
					</button>
				</div>

				<input type="hidden" name="item_type" value={itemType} />

				{#if itemType === 'media'}
					<div class="space-y-1">
						<label for="media_id" class="block text-xs font-medium text-zinc-300">Wybierz zasób:</label>
						<select id="media_id" name="media_id" required onchange={(e) => onSelect(e, false)} class="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200">
							<option value="">-- Wybierz dzieło --</option>
							{#each mediaList as m (m.id)}
								<option value={m.id}>{m.title} {m.artist_or_author ? `(${m.artist_or_author})` : ''}</option>
							{/each}
						</select>
					</div>
				{:else}
					<div class="space-y-1">
						<label for="source_id" class="block text-xs font-medium text-zinc-300">Wybierz źródło:</label>
						<select id="source_id" name="source_id" required onchange={(e) => onSelect(e, true)} class="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200">
							<option value="">-- Wybierz źródło --</option>
							{#each sourcesList as s (s.id)}
								<option value={s.id}>{s.work} · {s.section_ref}</option>
							{/each}
						</select>
					</div>
				{/if}

				<div class="space-y-1">
					<label for="title" class="block text-xs font-medium text-zinc-300">Tytuł analizy:</label>
					<input type="text" id="title" name="title" required bind:value={title} class="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500" placeholder="np. Marek Grechuta — „Korowód”" />
				</div>

				<div class="space-y-1">
					<label for="key_quote" class="block text-xs font-medium text-zinc-300">Fraza kluczowa:</label>
					<input type="text" id="key_quote" name="key_quote" bind:value={keyQuote} class="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500" placeholder="np. I jaki cel, i jaki sens?" />
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t border-zinc-800">
					<button type="button" onclick={onclose} class="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 cursor-pointer">
						{m.kuznia_btn_cancel()}
					</button>
					<button type="submit" class="rounded-md bg-amber-600 px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-500 cursor-pointer">
						{m.kuznia_new_deliberation()}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
