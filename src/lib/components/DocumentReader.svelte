<script lang="ts">
	import type { Snippet } from 'svelte';
	import BookOpen from 'lucide-svelte/icons/book-open';
	import Maximize2 from 'lucide-svelte/icons/maximize-2';
	import Minimize2 from 'lucide-svelte/icons/minimize-2';
	import Minus from 'lucide-svelte/icons/minus';
	import Plus from 'lucide-svelte/icons/plus';
	import X from 'lucide-svelte/icons/x';
	import { m } from '$lib/paraglide/messages.js';

	/**
	 * Reusable Reading Room (`DocumentReader.svelte`): can be imported anywhere (Transcripts, Canons, Sources,
	 * Spichlerz, Czasopismo) to read long-form HTML or plain text with zoom (80%–160%), 1 / 2 / 3 columns,
	 * and full-screen / windowed toggle.
	 */
	let {
		title,
		subtitle = '',
		html = '',
		text = '',
		initialColumns = 1,
		toolbar,
		onclose
	}: {
		title: string;
		subtitle?: string;
		html?: string;
		text?: string;
		initialColumns?: 1 | 2 | 3;
		toolbar?: Snippet;
		onclose: () => void;
	} = $props();

	const ZOOMS = [80, 90, 100, 110, 120, 135, 150] as const;
	let zoomIdx = $state(2); // 100%
	let columns = $state<1 | 2 | 3>(1);
	let fullscreen = $state(false);
	let dialogEl = $state<HTMLElement>();

	$effect(() => {
		columns = initialColumns;
	});

	$effect(() => {
		dialogEl?.focus();
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});

	const zoom = $derived(ZOOMS[zoomIdx]);
	const colLabels = [
		{ n: 1 as const, label: () => m.dr_cols_1() },
		{ n: 2 as const, label: () => m.dr_cols_2() },
		{ n: 3 as const, label: () => m.dr_cols_3() }
	];

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window {onkeydown} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 {fullscreen ? 'p-0' : 'p-2 sm:p-6'}"
	role="presentation"
	onclick={(e) => e.target === e.currentTarget && onclose()}
>
	<div
		bind:this={dialogEl}
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		class="flex flex-col overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl outline-none {fullscreen
			? 'h-dvh w-dvw rounded-none'
			: 'max-h-[92dvh] w-full max-w-7xl rounded-2xl'}"
	>
		<header class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/90 px-4 py-3">
			<div class="min-w-0 flex-1 basis-56">
				<h2 class="flex items-center gap-2 truncate text-sm font-semibold text-amber-300">
					<BookOpen class="h-4 w-4 shrink-0" />
					<span class="truncate">{title}</span>
				</h2>
				{#if subtitle}<p class="truncate text-xs text-zinc-400">{subtitle}</p>{/if}
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<!-- Zoom controls -->
				<div class="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-950 p-0.5 text-xs">
					<button
						type="button"
						disabled={zoomIdx <= 0}
						onclick={() => (zoomIdx = Math.max(0, zoomIdx - 1))}
						aria-label={m.dr_zoom_out()}
						title={m.dr_zoom_out()}
						class="rounded px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
					>
						<Minus class="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						onclick={() => (zoomIdx = 2)}
						title={m.dr_zoom_reset()}
						class="min-w-12 px-1.5 py-1 text-center font-mono text-amber-300 hover:bg-zinc-800"
					>
						{zoom}%
					</button>
					<button
						type="button"
						disabled={zoomIdx >= ZOOMS.length - 1}
						onclick={() => (zoomIdx = Math.min(ZOOMS.length - 1, zoomIdx + 1))}
						aria-label={m.dr_zoom_in()}
						title={m.dr_zoom_in()}
						class="rounded px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
					>
						<Plus class="h-3.5 w-3.5" />
					</button>
				</div>

				<!-- 1 / 2 / 3 columns -->
				<div class="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-950 p-0.5 text-xs">
					{#each colLabels as c (c.n)}
						<button
							type="button"
							onclick={() => (columns = c.n)}
							class="rounded px-2.5 py-1 font-medium transition {columns === c.n
								? 'bg-amber-500 text-zinc-950'
								: 'text-zinc-300 hover:bg-zinc-800'}"
						>
							{c.label()}
						</button>
					{/each}
				</div>

				<!-- Fullscreen toggle -->
				<button
					type="button"
					onclick={() => (fullscreen = !fullscreen)}
					title={fullscreen ? m.dr_windowed() : m.dr_fullscreen()}
					class="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
				>
					{#if fullscreen}<Minimize2 class="h-3.5 w-3.5" />{:else}<Maximize2 class="h-3.5 w-3.5" />{/if}
					<span class="hidden sm:inline">{fullscreen ? m.dr_windowed() : m.dr_fullscreen()}</span>
				</button>

				<button
					type="button"
					onclick={onclose}
					aria-label={m.dr_close()}
					title={m.dr_close()}
					class="rounded-lg border border-zinc-700 bg-zinc-950 p-1.5 text-zinc-300 hover:bg-zinc-800"
				>
					<X class="h-4 w-4" />
				</button>
			</div>
		</header>

		{#if toolbar}
			<div class="border-b border-zinc-800 bg-zinc-900/40 px-5 py-2.5">
				{@render toolbar()}
			</div>
		{/if}

		<div class="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
			<div
				style="font-size: {zoom}%;"
				class="dr-body mx-auto selection:bg-amber-500/30 selection:text-amber-100 {columns === 1
					? 'max-w-[70ch]'
					: columns === 2
						? 'max-w-5xl md:columns-2 md:gap-10'
						: 'max-w-7xl md:columns-2 lg:columns-3 lg:gap-9'}"
			>
				{#if html}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html html}
				{:else}
					<p class="whitespace-pre-line">{text}</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.dr-body {
		color: var(--color-zinc-200);
		line-height: 1.75;
		column-rule: 1px solid var(--color-zinc-800);
	}
	.dr-body :global(h1),
	.dr-body :global(h2),
	.dr-body :global(h3) {
		break-after: avoid;
		color: var(--color-amber-300);
		font-weight: 700;
		margin: 1.4em 0 0.5em;
	}
	.dr-body :global(h1) {
		font-size: 1.45em;
		color: var(--color-zinc-100);
		column-span: all;
		margin-top: 0;
	}
	.dr-body :global(p),
	.dr-body :global(ul),
	.dr-body :global(ol),
	.dr-body :global(blockquote) {
		margin: 0 0 1em;
	}
	.dr-body :global(blockquote) {
		border-left: 3px solid var(--color-amber-500);
		padding-left: 0.9em;
		color: var(--color-zinc-300);
		font-style: italic;
	}
	.dr-body :global(a) {
		color: var(--color-sky-400);
		text-decoration: underline;
	}
</style>
