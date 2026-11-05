<script lang="ts">
	import Rss from 'lucide-svelte/icons/rss';
	import { m } from '$lib/paraglide/messages.js';
	import { followPath, journalHome, libraryPath, type JournalLang } from '$lib/journal-paths';

	/** The journal's own masthead: name, sections, RSS and the switch to the other language's version of this page. */
	let { lang, current, other = null }: { lang: JournalLang; current: 'articles' | 'library' | 'follow'; other?: { lang: JournalLang; href: string } | null } = $props();
	const o = $derived({ locale: lang });
	const link = (active: boolean) => `border-b-2 pb-1 transition ${active ? 'border-amber-400 text-amber-300' : 'border-transparent text-zinc-400 hover:text-zinc-100'}`;
</script>

<header class="border-b border-zinc-800 pb-5">
	<a href={journalHome(lang)} class="block">
		<p class="font-serif text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">Lemiesz.</p>
		<p class="mt-1 font-serif text-lg text-zinc-300 sm:text-xl">{m.pub_subtitle({}, o)}</p>
	</a>
	<p class="mt-2 max-w-2xl text-sm text-zinc-400">{m.pub_tagline({}, o)}</p>
	<nav class="print-hidden mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium" aria-label={m.pub_subtitle({}, o)}>
		<a href="/" class={link(false)}>{m.pub_nav_home({}, o)}</a>
		<a href={journalHome(lang)} class={link(current === 'articles')}>{m.pub_nav_articles({}, o)}</a>
		<a href={libraryPath(lang)} class={link(current === 'library')}>{m.pub_nav_library({}, o)}</a>
		<a href={followPath(lang)} class="inline-flex items-center gap-1 {link(current === 'follow')}"><Rss class="h-3.5 w-3.5" />RSS</a>
		<a href="/redakcja" class={link(false)}>{m.pub_nav_editorial({}, o)}</a>
		{#if other}
			<a href={other.href} hreflang={other.lang} class="ml-auto pb-1 text-zinc-400 hover:text-amber-300">{m.pub_this_language({}, { locale: other.lang })}</a>
		{/if}
	</nav>
</header>
