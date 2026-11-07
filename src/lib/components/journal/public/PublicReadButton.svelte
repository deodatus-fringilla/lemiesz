<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { PublishedSummary } from '$lib/server/journal';
	import { articlePath, type JournalLang } from '$lib/journal-paths';
	import DocumentReader from '$lib/components/DocumentReader.svelte';

	/**
	 * Replaces the plain "Czytaj" link in Czasopismo with a button that opens the unified `<DocumentReader />`
	 * (zoom, 1/2/3 columns, full-screen toggle) right on the page.
	 */
	let {
		article,
		lang,
		beforeOpen
	}: {
		article: PublishedSummary;
		lang: JournalLang;
		beforeOpen?: () => void;
	} = $props();

	const o = $derived({ locale: lang });
	let open = $state(false);
	let loading = $state(false);
	let html = $state('');
	let initialColumns = $state<1 | 2 | 3>(1);

	/** Moves the reader to <body>: inside the abstract <dialog> it would be hidden (display:none) once that closes. */
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}

	async function openReader() {
		if (loading) return;
		loading = true;
		try {
			if (!html) {
				const res = await fetch(`${articlePath(lang, article.slug)}/reader.json`);
				if (!res.ok) throw new Error(String(res.status));
				const data = (await res.json()) as { html: string; columns?: 1 | 2 };
				html = data.html;
				initialColumns = data.columns === 2 ? 2 : 1;
			}
		} catch {
			// Never leave the reader blank: fall back to the full article page.
			window.location.href = articlePath(lang, article.slug);
			return;
		} finally {
			loading = false;
		}
		beforeOpen?.();
		open = true;
	}
</script>

<button
	type="button"
	disabled={loading}
	onclick={openReader}
	class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
>
	{m.pub_read({}, o)}
</button>

{#if open}
	<div use:portal>
		<DocumentReader
			title={article.title}
			subtitle="{article.author ?? m.pub_editorial({}, o)} · {article.published_at.slice(0, 10)} · {m.pub_minutes({ n: article.minutes }, o)}"
			{html}
			{initialColumns}
			onclose={() => (open = false)}
		/>
	</div>
{/if}
