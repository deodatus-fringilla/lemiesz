<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import { feedPath, journalHome, libraryPath, type JournalLang } from '$lib/journal-paths';

	/**
	 * The frame a signed-out reader sees on journal pages: no app header, internal menu or panel (those links only lead
	 * to the login page). The journal's own masthead, inside each page, carries the navigation and the language switch.
	 */
	let { children }: { children: Snippet } = $props();
	const lang = $derived<JournalLang>(page.url.pathname.startsWith('/en/') ? 'en' : 'pl');
	const o = $derived({ locale: lang });
</script>

<div class="flex min-h-dvh flex-col overflow-x-clip bg-zinc-950 font-sans text-zinc-100">
	<main class="flex-1">{@render children()}</main>
	<footer class="print-hidden border-t border-zinc-900 px-4 py-8 text-sm text-zinc-500">
		<div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
			<p class="font-serif text-zinc-400">{m.journal_name({}, o)}</p>
			<nav class="flex flex-wrap gap-4" aria-label={m.pub_subtitle({}, o)}>
				<a href={journalHome(lang)} class="hover:text-amber-300">{m.pub_nav_articles({}, o)}</a>
				<a href={libraryPath(lang)} class="hover:text-amber-300">{m.pub_nav_library({}, o)}</a>
				<a href={feedPath(lang)} class="hover:text-amber-300">RSS</a>
				<a href="/" class="hover:text-amber-300">{m.pub_publisher({}, o)}</a>
			</nav>
		</div>
	</footer>
</div>
