<script lang="ts">
	import Edit3 from 'lucide-svelte/icons/edit-3';
	import Save from 'lucide-svelte/icons/save';
	import X from 'lucide-svelte/icons/x';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		deliberationId: number;
		theologicalNotes: string;
		philosophicalNotes: string;
		politicalNotes: string;
		isEditing: boolean;
		ontoggleedit: () => void;
	}

	let {
		deliberationId,
		theologicalNotes,
		philosophicalNotes,
		politicalNotes,
		isEditing,
		ontoggleedit
	}: Props = $props();
</script>

<div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 shadow-sm space-y-4">
	<div class="flex items-center justify-between border-b border-zinc-800/80 pb-3">
		<div>
			<h3 class="text-sm sm:text-base font-semibold text-zinc-100 flex items-center gap-2">
				<span>Hermeneutyka Trójosiowa</span>
				<span class="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 border border-amber-500/20">
					Wiara • Rozum • Suwerenność
				</span>
			</h3>
		</div>
		<div>
			{#if !isEditing}
				<button
					type="button"
					onclick={ontoggleedit}
					class="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 cursor-pointer transition"
				>
					<Edit3 class="size-3.5" />
					<span>{m.kuznia_btn_edit()}</span>
				</button>
			{:else}
				<button
					type="button"
					onclick={ontoggleedit}
					class="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer transition"
				>
					<X class="size-3.5" />
					<span>{m.kuznia_btn_cancel()}</span>
				</button>
			{/if}
		</div>
	</div>

	{#snippet axisCard(title: string, borderCls: string, titleCls: string, content: string, emptyMsg: string)}
		<div class="rounded-lg border {borderCls} p-3.5 space-y-2">
			<div class="border-b border-zinc-800/60 pb-2">
				<h4 class="text-xs font-bold uppercase tracking-wider {titleCls}">{title}</h4>
			</div>
			<div class="text-xs leading-relaxed text-zinc-300 whitespace-pre-line">
				{content || emptyMsg}
			</div>
		</div>
	{/snippet}

	{#snippet editCol(id: string, name: string, label: string, hint: string, colorCls: string, value: string)}
		<div class="space-y-1.5">
			<label for={id} class="block text-xs font-semibold {colorCls}">{label}</label>
			<p class="text-[11px] text-zinc-400">{hint}</p>
			<textarea
				{id}
				{name}
				rows="7"
				class="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
				{value}
			></textarea>
		</div>
	{/snippet}

	{#if isEditing}
		<form method="POST" action="?/saveNotes" class="space-y-4">
			<input type="hidden" name="id" value={deliberationId} />
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				{@render editCol('theological_notes', 'theological_notes', m.kuznia_theology(), m.kuznia_theology_hint(), 'text-sky-400', theologicalNotes)}
				{@render editCol('philosophical_notes', 'philosophical_notes', m.kuznia_philosophy(), m.kuznia_philosophy_hint(), 'text-emerald-400', philosophicalNotes)}
				{@render editCol('political_notes', 'political_notes', m.kuznia_politics(), m.kuznia_politics_hint(), 'text-rose-400', politicalNotes)}
			</div>
			<div class="flex justify-end gap-2 pt-2 border-t border-zinc-800">
				<button
					type="submit"
					class="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-500 cursor-pointer transition shadow-sm"
				>
					<Save class="size-4" />
					<span>{m.kuznia_btn_save()}</span>
				</button>
			</div>
		</form>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			{@render axisCard(m.kuznia_theology(), 'border-sky-900/30 bg-sky-950/10', 'text-sky-400', theologicalNotes, 'Brak wpisów teologicznych.')}
			{@render axisCard(m.kuznia_philosophy(), 'border-emerald-900/30 bg-emerald-950/10', 'text-emerald-400', philosophicalNotes, 'Brak wpisów filozoficznych.')}
			{@render axisCard(m.kuznia_politics(), 'border-rose-900/30 bg-rose-950/10', 'text-rose-400', politicalNotes, 'Brak wpisów politycznych.')}
		</div>
	{/if}
</div>
