<script lang="ts">
	import { enhance } from '$app/forms';
	import Scissors from 'lucide-svelte/icons/scissors';
	import Swords from 'lucide-svelte/icons/swords';
	import { m } from '$lib/paraglide/messages.js';
	import { categoryLabel, languageLabel, originLabel } from '$lib/i18n/labels';
	import type { TranscriptDetail } from '$lib/server/transcripts';

	let {
		transcript,
		excerpt = $bindable(''),
		options,
		sourceOptions
	}: {
		transcript: TranscriptDetail;
		excerpt: string;
		options: { categories: string[]; origins: string[]; originalLocales: string[]; uiLocales: string[] };
		sourceOptions: { id: number; label: string }[];
	} = $props();

	let mode = $state<'source' | 'argument' | null>(null);
	const input = 'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm';
	const defaultWork = $derived(`${transcript.speaker ? `${transcript.speaker} — ` : ''}${transcript.title}${transcript.date ? ` (${transcript.date})` : ''}`);
</script>

<div class="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<p class="text-xs text-amber-200/90">
			{#if excerpt}
				<span class="font-semibold text-amber-300">{m.tr_selected({ n: excerpt.length })}:</span>
				<span class="italic text-zinc-300"> „{excerpt.slice(0, 120)}{excerpt.length > 120 ? '…' : ''}”</span>
			{:else}
				{m.tr_select_hint()}
			{/if}
		</p>
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={() => (mode = mode === 'source' ? null : 'source')}
				class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition {mode === 'source'
					? 'border-amber-400 bg-amber-500 text-zinc-950'
					: 'border-amber-500/40 bg-zinc-900 text-amber-300 hover:bg-amber-500/10'}"
			>
				<Scissors class="h-3.5 w-3.5" />{m.tr_carve_source()}
			</button>
			<button
				type="button"
				onclick={() => (mode = mode === 'argument' ? null : 'argument')}
				class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition {mode === 'argument'
					? 'border-amber-400 bg-amber-500 text-zinc-950'
					: 'border-amber-500/40 bg-zinc-900 text-amber-300 hover:bg-amber-500/10'}"
			>
				<Swords class="h-3.5 w-3.5" />{m.tr_carve_argument()}
			</button>
			{#if excerpt}
				<button type="button" onclick={() => { excerpt = ''; mode = null; }} class="text-xs text-zinc-400 hover:text-zinc-200">
					{m.tr_clear_selection()}
				</button>
			{/if}
		</div>
	</div>

	{#if mode === 'source'}
		<form method="POST" action="?/create" use:enhance class="mt-3 grid gap-3 border-t border-amber-500/20 pt-3 md:grid-cols-2">
			<label class="block text-xs"><span class="mb-1 block text-zinc-300">{m.f_work()}</span><input name="work" required value={defaultWork} class={input} /></label>
			<label class="block text-xs"><span class="mb-1 block text-zinc-300">{m.f_section()}</span><input name="section_ref" required placeholder="np. [04:26] / §1" class={input} /></label>
			<label class="block text-xs">
				<span class="mb-1 block text-zinc-300">{m.f_category()}</span>
				<select name="category" class={input}>
					{#each options.categories as c (c)}<option value={c} selected={c === 'geopolitics'}>{categoryLabel(c)}</option>{/each}
				</select>
			</label>
			<label class="block text-xs"><span class="mb-1 block text-zinc-300">{m.f_url()}</span><input name="url" value={transcript.sourceUrl ?? ''} class={input} /></label>
			<label class="block text-xs md:col-span-2">
				<span class="mb-1 block text-zinc-300">{m.f_license()}</span>
				<input name="license" required value="Cytat na prawach prawa cytatu (wypowiedź publiczna / wystąpienie oficjalne)" class={input} />
			</label>
			<label class="block text-xs">
				<span class="mb-1 block text-zinc-300">{m.f_original_locale()}</span>
				<select name="original_locale" class={input}>
					{#each options.originalLocales as l (l)}<option value={l} selected={l === 'pl'}>{languageLabel(l)}</option>{/each}
				</select>
			</label>
			<label class="block text-xs">
				<span class="mb-1 block text-zinc-300">{m.f_locale()}</span>
				<select name="locale" class={input}>
					{#each options.originalLocales as l (l)}<option value={l} selected={l === 'pl'}>{languageLabel(l)}</option>{/each}
				</select>
			</label>
			<label class="block text-xs">
				<span class="mb-1 block text-zinc-300">{m.f_origin()}</span>
				<select name="origin" class={input}>
					{#each options.origins as o (o)}<option value={o} selected={o === 'original'}>{originLabel(o)}</option>{/each}
				</select>
			</label>
			<label class="block text-xs"><span class="mb-1 block text-zinc-300">{m.f_keywords()}</span><input name="keywords" value={transcript.speaker ?? ''} class={input} /></label>
			<label class="block text-xs md:col-span-2">
				<span class="mb-1 block text-zinc-300">{m.f_text()}</span>
				<textarea name="text" rows="4" required bind:value={excerpt} class={input}></textarea>
			</label>
			<label class="flex items-center gap-2 text-xs md:col-span-2">
				<input type="checkbox" name="cleared_to_store" checked />{m.f_cleared()}
			</label>
			<div class="flex gap-2 md:col-span-2">
				<button class="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-zinc-950">{m.repo_save()}</button>
				<button type="button" onclick={() => (mode = null)} class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs">{m.repo_cancel()}</button>
			</div>
		</form>
	{:else if mode === 'argument'}
		<form method="POST" action="?/carveArgument" use:enhance class="mt-3 grid gap-3 border-t border-amber-500/20 pt-3 md:grid-cols-2">
			<label class="block text-xs">
				<span class="mb-1 block text-zinc-300">{m.f_locale()}</span>
				<select name="locale" class={input}>
					{#each options.uiLocales as l (l)}<option value={l} selected={l === 'pl'}>{languageLabel(l)}</option>{/each}
				</select>
			</label>
			<label class="block text-xs"><span class="mb-1 block text-zinc-300">{m.tr_core_principle()}</span><input name="core_principle" required placeholder="np. Doktryna Jeża / Zamek parlamentarny" class={input} /></label>
			<label class="block text-xs md:col-span-2">
				<span class="mb-1 block text-zinc-300">{m.tr_opponent_claim()}</span>
				<textarea name="opponent_claim" rows="3" required bind:value={excerpt} class={input}></textarea>
			</label>
			<label class="block text-xs md:col-span-2">
				<span class="mb-1 block text-zinc-300">{m.tr_counter_punch()}</span>
				<textarea name="counter_punch" rows="4" required class={input}></textarea>
			</label>
			<label class="block text-xs"><span class="mb-1 block text-zinc-300">{m.tr_fallacy()}</span><input name="fallacy_type" class={input} /></label>
			<label class="block text-xs">
				<span class="mb-1 block text-zinc-300">{m.tr_linked_sources()}</span>
				<select name="source_ids" multiple size="2" class={input}>
					{#each sourceOptions as s (s.id)}<option value={s.id}>#{s.id} {s.label}</option>{/each}
				</select>
			</label>
			<div class="flex gap-2 md:col-span-2">
				<button class="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-zinc-950">{m.repo_save()}</button>
				<button type="button" onclick={() => (mode = null)} class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs">{m.repo_cancel()}</button>
			</div>
		</form>
	{/if}
</div>
