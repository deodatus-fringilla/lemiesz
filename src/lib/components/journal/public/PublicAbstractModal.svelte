<script lang="ts">
	import FileText from 'lucide-svelte/icons/file-text';
	import X from 'lucide-svelte/icons/x';
	import { m } from '$lib/paraglide/messages.js';
	import type { PublishedSummary } from '$lib/server/journal';
	import type { JournalLang } from '$lib/journal-paths';
	import JournalCaliberBadge from '../JournalCaliberBadge.svelte';
	import PublicReadButton from './PublicReadButton.svelte';

	/** An "Abstrakt" button that opens the article's full abstract (its lead) in a dialog, with a way on to the text. */
	let { article, lang }: { article: PublishedSummary; lang: JournalLang } = $props();
	const o = $derived({ locale: lang });
	let dialog = $state<HTMLDialogElement>();
</script>

<button type="button" onclick={() => dialog?.showModal()} class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800">
	<FileText class="h-4 w-4" />{m.pub_abstract({}, o)}
</button>

<dialog bind:this={dialog} onclick={(e) => e.target === dialog && dialog?.close()} aria-label={m.pub_abstract({}, o)}
	class="m-auto w-[min(42rem,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-950 p-0 text-zinc-100 backdrop:bg-black/70">
	<div class="max-h-[80vh] space-y-4 overflow-y-auto p-5 sm:p-7">
		<div class="flex items-start justify-between gap-3">
			<div class="space-y-2">
				<JournalCaliberBadge caliber={article.caliber} {lang} />
				<h2 class="text-xl leading-snug font-bold text-zinc-50 {article.caliber === 'heavy' ? 'font-serif' : ''}">{article.title}</h2>
			</div>
			<form method="dialog"><button aria-label={m.pub_close({}, o)} class="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"><X class="h-5 w-5" /></button></form>
		</div>
		<p class="text-xs font-semibold tracking-wider text-zinc-500 uppercase">{m.pub_abstract({}, o)} · {m.pub_minutes({ n: article.minutes }, o)}</p>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="abstract leading-relaxed text-zinc-300 {article.caliber === 'heavy' ? 'font-serif' : ''}">{@html article.lead_html}</div>
		<PublicReadButton {article} {lang} beforeOpen={() => dialog?.close()} />
	</div>
</dialog>

<style>
	/* The abstract is Markdown from the editor, rendered on the server. */
	.abstract :global(p) {
		margin: 0 0 0.8em;
	}
	.abstract :global(p:last-child) {
		margin-bottom: 0;
	}
	.abstract :global(ul),
	.abstract :global(ol) {
		margin: 0 0 0.8em;
		padding-left: 1.4em;
		list-style: revert;
	}
	.abstract :global(a) {
		color: rgb(252 211 77);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
