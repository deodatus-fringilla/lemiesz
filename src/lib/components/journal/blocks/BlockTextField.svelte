<script lang="ts">
	import { tick } from 'svelte';
	import Bold from 'lucide-svelte/icons/bold';
	import Italic from 'lucide-svelte/icons/italic';
	import Link from 'lucide-svelte/icons/link';
	import List from 'lucide-svelte/icons/list';
	import ListOrdered from 'lucide-svelte/icons/list-ordered';
	import Quote from 'lucide-svelte/icons/quote';
	import { m } from '$lib/paraglide/messages.js';
	import type { CitableSource } from '$lib/server/journal-citations';
	import { insertAt, prefixLines, wrap, type Edit } from './md-edit';
	import SourcePicker from './SourcePicker.svelte';

	/** A text or highlight block: Markdown with a toolbar, so nobody has to type the syntax by hand. */
	let { value = $bindable(), kind, sources, locale }: { value: string; kind: 'text' | 'callout'; sources: CitableSource[]; locale: string } = $props();

	let ta = $state<HTMLTextAreaElement>();
	let picking = $state(false);

	async function apply(f: (v: string, s: number, e: number) => Edit) {
		if (!ta) return;
		const r = f(value, ta.selectionStart, ta.selectionEnd);
		value = r.value;
		await tick();
		ta.focus();
		ta.setSelectionRange(r.start, r.end);
	}
	const tools = [
		{ icon: Bold, label: () => m.blocks_tb_bold(), run: () => apply((v, s, e) => wrap(v, s, e, '**', '**', m.blocks_tb_bold())) },
		{ icon: Italic, label: () => m.blocks_tb_italic(), run: () => apply((v, s, e) => wrap(v, s, e, '*', '*', m.blocks_tb_italic())) },
		{ icon: Link, label: () => m.blocks_tb_link(), run: () => apply((v, s, e) => wrap(v, s, e, '[', '](https://)', m.blocks_tb_link_text())) },
		{ icon: List, label: () => m.blocks_tb_list(), run: () => apply((v, s, e) => prefixLines(v, s, e, 'bullet')) },
		{ icon: ListOrdered, label: () => m.blocks_tb_numbered(), run: () => apply((v, s, e) => prefixLines(v, s, e, 'numbered')) }
	];
	const btn = 'rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100';
</script>

<div class="space-y-1.5">
	<div class="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label={m.blocks_toolbar()}>
		{#each tools as t (t.label())}
			<button type="button" class={btn} title={t.label()} aria-label={t.label()} onclick={t.run}><t.icon class="h-4 w-4" /></button>
		{/each}
		<button type="button" class="{btn} inline-flex items-center gap-1 text-xs" aria-expanded={picking} onclick={() => (picking = !picking)}>
			<Quote class="h-4 w-4" />{m.blocks_tb_cite()}
		</button>
	</div>
	{#if picking}
		<SourcePicker {sources} {locale} onpick={(id) => { picking = false; apply((v, s, e) => insertAt(v, s, e, `[[src:${id}]]`)); }} />
	{/if}
	<textarea
		bind:this={ta}
		bind:value
		lang={locale}
		rows="4"
		placeholder={kind === 'callout' ? m.blocks_placeholder_callout() : m.blocks_placeholder_text()}
		class="field-auto w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-[15px] leading-7 text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
	></textarea>
</div>

<style>
	/* Grows with its content where supported; otherwise four rows and the user can drag it taller. */
	.field-auto {
		field-sizing: content;
		min-height: 6.5rem;
	}
</style>
