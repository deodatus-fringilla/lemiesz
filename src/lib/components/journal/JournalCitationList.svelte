<script lang="ts">
	import CircleCheck from 'lucide-svelte/icons/circle-check';
	import CircleAlert from 'lucide-svelte/icons/circle-alert';
	import { m } from '$lib/paraglide/messages.js';
	import type { CitationInfo } from '$lib/server/journal-citations';

	/** Every [[src:ID]] / [[quote:ID]] in the body and whether it resolves to approved stored text. */
	let { citations }: { citations: CitationInfo[] } = $props();
	const reason = (r: CitationInfo['problem']) =>
		r === 'unknown_source' ? m.journal_cite_unknown() : r === 'not_approved' ? m.journal_cite_not_approved() : m.journal_cite_no_locale();
</script>

<section class="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
	<h3 class="text-xs font-semibold tracking-wider text-zinc-400 uppercase">{m.journal_citations({ count: citations.length })}</h3>
	{#if citations.length === 0}
		<p class="text-xs text-zinc-500 italic">{m.journal_citations_none()}</p>
	{:else}
		<ul class="space-y-1.5 text-xs">
			{#each citations as c (c.token)}
				<li class="flex items-start gap-2">
					{#if c.problem}<CircleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />{:else}<CircleCheck class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />{/if}
					<span class="min-w-0">
						<code class="font-mono text-zinc-300">{c.token}</code>
						<span class="block text-zinc-400">{c.label ?? '—'}</span>
						{#if c.problem}<span class="block text-rose-300">{reason(c.problem)}</span>{/if}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
