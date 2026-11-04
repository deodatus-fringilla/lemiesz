<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	/** One tab per language; a language with no text yet can be started from here. */
	let { articleId, locales, allLocales, current }: { articleId: number; locales: string[]; allLocales: string[]; current: string } = $props();
</script>

<nav class="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-xs" aria-label={m.journal_languages()}>
	{#each allLocales as l (l)}
		<a
			href="/redakcja/{articleId}?lang={l}"
			aria-current={l === current ? 'page' : undefined}
			class="rounded-md px-3 py-1 font-semibold uppercase transition {l === current ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'}"
		>
			{l}{#if !locales.includes(l)}<span class="ml-1 font-normal normal-case opacity-70">+</span>{/if}
		</a>
	{/each}
</nav>
