<script lang="ts">
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import X from 'lucide-svelte/icons/x';
	import BookOpen from 'lucide-svelte/icons/book-open';
	import { m } from '$lib/paraglide/messages.js';
	import { buildRounds, roundIndexOf, type ReaderLetter } from './letter-reader';
	import LetterPage from './LetterPage.svelte';

	/** Standalone two-page letter reader: the letter on the left, the reply on the right, one round per spread. */
	let {
		letters,
		initialLetterId,
		title = '',
		highlight = '',
		onclose
	}: { letters: ReaderLetter[]; initialLetterId?: number; title?: string; highlight?: string; onclose: () => void } = $props();

	const rounds = $derived(buildRounds(letters));
	let chosen = $state<number | null>(null);
	const index = $derived(Math.min(chosen ?? roundIndexOf(rounds, initialLetterId), Math.max(rounds.length - 1, 0)));
	const round = $derived(rounds[index]);

	// Move focus into the dialog (keyboard and screen readers) and stop the page behind from scrolling.
	let dialogEl = $state<HTMLElement>();
	$effect(() => {
		dialogEl?.focus();
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});

	const go = (to: number) => (chosen = Math.max(0, Math.min(rounds.length - 1, to)));

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		else if (e.key === 'ArrowRight') go(index + 1);
		else if (e.key === 'ArrowLeft') go(index - 1);
	}

	const navBtn =
		'inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-amber-500/50 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-zinc-700 disabled:hover:text-zinc-200';
</script>

<svelte:window {onkeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-6" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
	<div bind:this={dialogEl} tabindex="-1" role="dialog" aria-modal="true" aria-label={m.letter_reader_title()} class="flex max-h-full w-full max-w-6xl flex-col outline-none overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
		<div class="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2.5">
			<h2 class="flex min-w-0 items-center gap-2 text-sm font-semibold text-amber-400">
				<BookOpen class="h-4 w-4 shrink-0" />
				<span class="truncate">{title || m.letter_reader_title()}</span>
			</h2>
			<button type="button" onclick={onclose} aria-label={m.letter_reader_close()} class="rounded-lg border border-zinc-700 p-1.5 text-zinc-300 hover:bg-zinc-800">
				<X class="h-4 w-4" />
			</button>
		</div>

		{#if round}
			<div class="grid min-h-0 flex-1 grid-cols-1 divide-y divide-zinc-800 overflow-y-auto md:h-[70dvh] md:grid-cols-2 md:divide-x md:divide-y-0 md:overflow-hidden">
				<LetterPage letter={round.letter} kind="letter" {highlight} />
				<LetterPage letter={round.response} kind="response" {highlight} />
			</div>
		{/if}

		<div class="flex items-center justify-between gap-2 border-t border-zinc-800 px-4 py-2.5">
			<button type="button" class={navBtn} disabled={index <= 0} onclick={() => go(index - 1)}>
				<ChevronLeft class="h-3.5 w-3.5" /><span class="hidden sm:inline">{m.letter_reader_prev()}</span>
			</button>
			<span class="font-mono text-xs text-zinc-400">{m.letter_reader_round({ current: index + 1, total: rounds.length })}</span>
			<button type="button" class={navBtn} disabled={index >= rounds.length - 1} onclick={() => go(index + 1)}>
				<span class="hidden sm:inline">{m.letter_reader_next()}</span><ChevronRight class="h-3.5 w-3.5" />
			</button>
		</div>
	</div>
</div>
