<script lang="ts">
	import Mail from 'lucide-svelte/icons/mail';
	import Inbox from 'lucide-svelte/icons/inbox';
	import { highlight as highlightMatches } from '$lib/actions/highlight';
	import { m } from '$lib/paraglide/messages.js';
	import type { ReaderLetter } from './letter-reader';

	let {
		letter,
		kind,
		highlight = ''
	}: { letter: ReaderLetter | null; kind: 'letter' | 'response'; highlight?: string } = $props();

	// Rendered via {@html} (escaped) so a round change replaces the whole block, including any highlight marks.
	const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
</script>

<article class="flex min-h-0 flex-col bg-zinc-950/95 px-5 py-4 sm:px-8 sm:py-6">
	<header class="mb-4 space-y-1.5 border-b border-zinc-800 pb-3 text-xs">
		<span
			class="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-semibold {kind === 'letter'
				? 'border-crimson-500/40 bg-crimson-500/15 text-crimson-300'
				: 'border-sky-500/40 bg-sky-500/15 text-sky-300'}"
		>
			{#if kind === 'letter'}<Mail class="h-3 w-3" />{:else}<Inbox class="h-3 w-3" />{/if}
			{kind === 'letter' ? m.letter_reader_letter() : m.letter_reader_response()}
			{#if letter}· #{letter.turn_number}{/if}
		</span>
		{#if letter}
			<p class="text-zinc-400">{letter.sender} → {letter.recipient}</p>
			<p class="font-mono text-[11px] text-zinc-500">{letter.date_label} · {letter.filename}</p>
		{/if}
	</header>

	{#if letter}
		<div
			use:highlightMatches={{ query: highlight, key: letter.id, scroll: true }}
			class="min-h-0 flex-1 overflow-y-auto pr-2 font-serif text-[15px] leading-7 whitespace-pre-wrap text-zinc-200"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html escape(letter.body)}
		</div>
	{:else}
		<p class="m-auto text-center font-serif text-sm text-zinc-500 italic">{m.letter_reader_no_response()}</p>
	{/if}
</article>
