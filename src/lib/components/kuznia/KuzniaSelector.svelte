<script lang="ts">
	import type { KuzniaDeliberation } from '$lib/server/kuznia';
	import Music from 'lucide-svelte/icons/music';
	import Image from 'lucide-svelte/icons/image';
	import BookOpen from 'lucide-svelte/icons/book-open';
	import Plus from 'lucide-svelte/icons/plus';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		deliberations: KuzniaDeliberation[];
		selectedId: number | null;
		activeFilter: 'all' | 'music' | 'art' | 'sources';
		onselect: (id: number) => void;
		onfilterchange: (f: 'all' | 'music' | 'art' | 'sources') => void;
		onnew: () => void;
	}

	let { deliberations, selectedId, activeFilter, onselect, onfilterchange, onnew }: Props = $props();

	const filtered = $derived(
		deliberations.filter((d) => {
			if (activeFilter === 'all') return true;
			if (activeFilter === 'sources') return d.item_type === 'source';
			if (activeFilter === 'music') return d.item_type === 'media' && d.media?.media_type === 'music';
			if (activeFilter === 'art') return d.item_type === 'media' && d.media?.media_type !== 'music';
			return true;
		})
	);
</script>

<div class="space-y-3">
	<!-- Filter bar + Add button -->
	<div class="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
		<div class="flex flex-wrap items-center gap-1.5 text-xs">
			<button
				type="button"
				onclick={() => onfilterchange('all')}
				class="rounded-md px-3 py-1.5 font-medium transition cursor-pointer {activeFilter === 'all'
					? 'bg-amber-600/30 text-amber-200 border border-amber-500/50'
					: 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'}"
			>
				{m.kuznia_tab_all()}
			</button>
			<button
				type="button"
				onclick={() => onfilterchange('music')}
				class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition cursor-pointer {activeFilter === 'music'
					? 'bg-amber-600/30 text-amber-200 border border-amber-500/50'
					: 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'}"
			>
				<Music class="size-3.5" />
				{m.kuznia_tab_music()}
			</button>
			<button
				type="button"
				onclick={() => onfilterchange('art')}
				class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition cursor-pointer {activeFilter === 'art'
					? 'bg-amber-600/30 text-amber-200 border border-amber-500/50'
					: 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'}"
			>
				<Image class="size-3.5" />
				{m.kuznia_tab_art()}
			</button>
			<button
				type="button"
				onclick={() => onfilterchange('sources')}
				class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition cursor-pointer {activeFilter === 'sources'
					? 'bg-amber-600/30 text-amber-200 border border-amber-500/50'
					: 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'}"
			>
				<BookOpen class="size-3.5" />
				{m.kuznia_tab_sources()}
			</button>
		</div>

		<button
			type="button"
			onclick={onnew}
			class="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-500 cursor-pointer shadow-sm"
		>
			<Plus class="size-4" />
			{m.kuznia_new_deliberation()}
		</button>
	</div>

	<!-- Deliberations selector strip -->
	<div class="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
		{#if filtered.length === 0}
			<p class="py-2 text-xs text-zinc-500">{m.kuznia_empty()}</p>
		{:else}
			{#each filtered as item (item.id)}
				{@const isSel = selectedId === item.id}
				<button
					type="button"
					onclick={() => onselect(item.id)}
					class="flex shrink-0 max-w-[280px] flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition cursor-pointer {isSel
						? 'border-amber-500/70 bg-amber-950/20 ring-1 ring-amber-500/40 shadow-sm'
						: 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900'}"
				>
					<div class="flex w-full items-center justify-between gap-2 text-[10px]">
						<span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium {item.item_type === 'media' ? 'bg-sky-950/60 text-sky-300 border border-sky-800/40' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'}">
							{#if item.item_type === 'media'}
								<Music class="size-2.5" />
								{item.media?.media_type === 'music' ? 'Utwór' : 'Dzieło'}
							{:else}
								<BookOpen class="size-2.5" />
								Źródło
							{/if}
						</span>
						{#if item.status === 'human_approved'}
							<span class="text-emerald-400 font-medium">✓ Zatwierdzony</span>
						{/if}
					</div>
					<div class="line-clamp-1 text-xs font-semibold text-zinc-200" title={item.title}>
						{item.title}
					</div>
					{#if item.key_quote}
						<div class="line-clamp-1 text-[11px] italic text-zinc-400">
							„{item.key_quote}”
						</div>
					{/if}
				</button>
			{/each}
		{/if}
	</div>
</div>
