<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { EditorRow } from '$lib/server/journal';
	import JournalCaliberBadge from './JournalCaliberBadge.svelte';
	import JournalStateBadge from './JournalStateBadge.svelte';

	let { articles }: { articles: EditorRow[] } = $props();
</script>

{#if articles.length === 0}
	<p class="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">{m.journal_empty()}</p>
{:else}
	<ul class="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
		{#each articles as a (`${a.id}-${a.locale}`)}
			<li>
				<a href="/redakcja/{a.id}?lang={a.locale}" class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition hover:bg-zinc-800/50">
					<JournalCaliberBadge caliber={a.caliber} />
					<span class="min-w-0 flex-1 font-medium text-zinc-100">{a.title}</span>
					<span class="font-mono text-[11px] text-zinc-500 uppercase">{a.locale}</span>
					<JournalStateBadge status={a.status} revision={a.revision} published_revision={a.published_revision} approvals={a.approvals} required={a.required} />
					<span class="font-mono text-[11px] text-zinc-400" title={m.journal_approvals_hint()}>
						{m.journal_approvals_count({ have: a.approvals, need: a.required })}
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
