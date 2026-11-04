<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { Footnote } from '$lib/server/journal-render';
	import type { JournalLang } from '$lib/journal-paths';

	let { notes, lang }: { notes: Footnote[]; lang: JournalLang } = $props();
</script>

{#if notes.length}
	<section class="mt-10 border-t border-zinc-800 pt-5" aria-labelledby="przypisy">
		<h2 id="przypisy" class="text-xs font-semibold tracking-wider text-zinc-400 uppercase">{m.pub_footnotes({}, { locale: lang })}</h2>
		<ol class="mt-3 space-y-1.5 text-sm text-zinc-400">
			{#each notes as n (n.n)}
				<li id="przypis-{n.n}" class="flex gap-2">
					<span class="w-5 shrink-0 text-right font-mono text-crimson-300">{n.n}.</span>
					<span>
						{n.work}, {n.section_ref}
						{#if n.url}· <a href={n.url} rel="noopener noreferrer nofollow" target="_blank" class="text-amber-300/90 underline underline-offset-2">{m.pub_source_link({}, { locale: lang })}</a>{/if}
					</span>
				</li>
			{/each}
		</ol>
	</section>
{/if}
