<script lang="ts">
	import Home from 'lucide-svelte/icons/house';
	import BookOpen from 'lucide-svelte/icons/book-open';
	import Library from 'lucide-svelte/icons/library';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { journalHome, libraryPath, type JournalLang } from '$lib/journal-paths';

	/** Links from the Redakcja back-office to the site and the public journal, following the interface language; the library also opens in the other language. */
	const lang: JournalLang = $derived(getLocale() === 'en' ? 'en' : 'pl');
	const other: JournalLang = $derived(lang === 'en' ? 'pl' : 'en');
	const cls = 'inline-flex items-center gap-1.5 text-zinc-400 transition hover:text-amber-300';
</script>

<div class="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 text-sm font-medium">
	<a href="/" class={cls}><Home class="h-4 w-4" />{m.pub_nav_home()}</a>
	<a href={journalHome(lang)} class={cls}><BookOpen class="h-4 w-4" />{m.nav_journal_public()}</a>
	<a href={libraryPath(lang)} class={cls}><Library class="h-4 w-4" />{m.pub_nav_library()}</a>
	<a href={libraryPath(other)} hreflang={other} class={cls}>
		<Library class="h-4 w-4" />{m.pub_nav_library({}, { locale: other })} <span class="font-mono text-xs uppercase opacity-70">{other}</span>
	</a>
</div>
