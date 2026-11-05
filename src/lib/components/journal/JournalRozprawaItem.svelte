<script lang="ts">
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import type { EditorRow } from '$lib/server/journal';
	import type { EditorPair } from '$lib/journal-pairs';
	import JournalVersionCell from './JournalVersionCell.svelte';
	import JournalVersionChip from './JournalVersionChip.svelte';

	/** One rozprawe as an accordion item (one open at a time, via the shared details name): title and the state of both versions in the header, the two versions to open inside. */
	let { pair, open = false }: { pair: EditorPair<EditorRow>; open?: boolean } = $props();
	const main = $derived(pair.heavy ?? pair.light);
</script>

<details {open} name="redakcja-rozprawy" class="group">
	<summary class="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition hover:bg-zinc-800/40 [&::-webkit-details-marker]:hidden">
		<ChevronRight class="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-90" />
		<span class="min-w-0 flex-1 basis-56 font-serif text-base font-semibold text-zinc-100">{main?.title}</span>
		<span class="flex flex-wrap items-center gap-x-3 gap-y-1">
			<JournalVersionChip row={pair.light} caliber="light" />
			<JournalVersionChip row={pair.heavy} caliber="heavy" />
		</span>
		<span class="font-mono text-[11px] text-zinc-500 uppercase">{pair.locale}</span>
	</summary>
	<div class="grid gap-2 px-4 pb-3 md:grid-cols-2">
		<JournalVersionCell row={pair.light} caliber="light" />
		<JournalVersionCell row={pair.heavy} caliber="heavy" />
	</div>
</details>
