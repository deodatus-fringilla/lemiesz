<script lang="ts">
	import { enhance } from '$app/forms';
	import BookOpen from 'lucide-svelte/icons/book-open';
	import Check from 'lucide-svelte/icons/check';
	import Copy from 'lucide-svelte/icons/copy';
	import ExternalLink from 'lucide-svelte/icons/external-link';
	import { m } from '$lib/paraglide/messages.js';
	import DocumentReader from '$lib/components/DocumentReader.svelte';
	import type { TranscriptDetail } from '$lib/server/transcripts';
	import TranscriptCarveBar from './TranscriptCarveBar.svelte';
	import TranscriptForm from './TranscriptForm.svelte';

	let {
		transcript,
		folders,
		options,
		sourceOptions,
		isAdmin = false
	}: {
		transcript: TranscriptDetail;
		folders: { name: string; count: number }[];
		options: { categories: string[]; origins: string[]; originalLocales: string[]; uiLocales: string[] };
		sourceOptions: { id: number; label: string }[];
		isAdmin?: boolean;
	} = $props();

	let excerpt = $state('');
	let copied = $state(false);
	let readerOpen = $state(false);

	$effect(() => {
		const onSelect = () => {
			const sel = document.getSelection()?.toString().trim() ?? '';
			if (sel.length >= 8) excerpt = sel;
		};
		document.addEventListener('selectionchange', onSelect);
		return () => document.removeEventListener('selectionchange', onSelect);
	});

	async function copyAll() {
		await navigator.clipboard.writeText(transcript.body);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<article class="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
	<header class="space-y-2 border-b border-zinc-800 pb-4">
		<div class="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
			<span class="rounded bg-amber-500/10 px-2 py-0.5 font-mono text-amber-300">{transcript.folder}</span>
			{#if transcript.speaker}<span>· {transcript.speaker}</span>{/if}
			{#if transcript.date}<span>· {transcript.date}</span>{/if}
			<span>· {m.tr_words({ n: transcript.wordCount })}</span>
		</div>
		<h2 class="text-xl font-semibold text-zinc-100">{transcript.title}</h2>
		<p class="font-mono text-xs text-zinc-500">{m.tr_file()}: {transcript.file}</p>

		<div class="flex flex-wrap items-center gap-2 pt-1">
			<button type="button" onclick={copyAll} class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">
				{#if copied}<Check class="h-3.5 w-3.5 text-emerald-400" />{m.spichlerz_copied()}{:else}<Copy class="h-3.5 w-3.5" />{m.spichlerz_copy_letter()}{/if}
			</button>
			{#if transcript.sourceUrl}
				<a
					href={transcript.sourceUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-500/10"
				>
					<ExternalLink class="h-3.5 w-3.5" />{m.repo_open_source()}
				</a>
			{/if}
			<button
				type="button"
				onclick={() => (readerOpen = true)}
				class="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
			>
				<BookOpen class="h-3.5 w-3.5" />{m.dr_open()}
			</button>
		</div>
	</header>

	<TranscriptCarveBar {transcript} bind:excerpt {options} {sourceOptions} />

	<section
		aria-label={transcript.title}
		class="canon max-h-[65vh] overflow-y-auto rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-5 selection:bg-amber-500/30 selection:text-amber-100"
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html transcript.html}
	</section>

	<details class="rounded-lg border border-zinc-800">
		<summary class="cursor-pointer px-3 py-2 text-sm text-zinc-300">{m.tr_edit()}</summary>
		<div class="border-t border-zinc-800 p-3">
			<TranscriptForm {transcript} {folders} />
		</div>
	</details>

	{#if isAdmin}
		<form
			method="POST"
			action="?/deleteTranscript"
			use:enhance={({ cancel }) => {
				if (!confirm(m.tr_delete_confirm({ name: transcript.filename }))) cancel();
			}}
		>
			<input type="hidden" name="slug" value={transcript.slug} />
			<button class="text-xs text-rose-400 hover:underline">{m.repo_delete()}</button>
		</form>
	{/if}
</article>

{#if readerOpen}
	<DocumentReader
		title={transcript.title}
		subtitle="{transcript.folder}{transcript.speaker ? ` · ${transcript.speaker}` : ''}{transcript.date ? ` · ${transcript.date}` : ''} · {m.tr_words({ n: transcript.wordCount })}"
		html={transcript.html}
		onclose={() => (readerOpen = false)}
	>
		{#snippet toolbar()}
			<TranscriptCarveBar {transcript} bind:excerpt {options} {sourceOptions} />
		{/snippet}
	</DocumentReader>
{/if}
