<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages.js';
	import type { EditorRow } from '$lib/server/journal';
	import JournalCaliberBadge from './JournalCaliberBadge.svelte';
	import JournalStateBadge from './JournalStateBadge.svelte';

	/** One version of a rozprawe in the back-office: opens its editor; shows its state and approvals, or that it does not exist yet. */
	let { row, caliber }: { row: EditorRow | null; caliber: 'light' | 'heavy' } = $props();
</script>

{#if row}
	<div class="space-y-1.5">
	<a href="/redakcja/{row.id}?lang={row.locale}" class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 transition hover:border-zinc-600 hover:bg-zinc-800/50">
		<JournalCaliberBadge caliber={row.caliber} />
		<JournalStateBadge status={row.status} revision={row.revision} published_revision={row.published_revision} approvals={row.approvals} required={row.required} />
		<span class="font-mono text-[11px] text-zinc-400" title={m.journal_approvals_hint()}>{m.journal_approvals_count({ have: row.approvals, need: row.required })}</span>
	</a>
	{#if row.published_revision !== null}
		<form method="POST" action="/redakcja/{row.id}?/unpublish" use:enhance onsubmit={(e) => !confirm(m.journal_unpublish_confirm()) && e.preventDefault()}>
			<input type="hidden" name="locale" value={row.locale} />
			<button class="w-full rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/10">{m.journal_unpublish()}</button>
		</form>
	{/if}
	{#if row.published_revision === null && row.status === 'human_approved'}
		<form method="POST" action="/redakcja/{row.id}?/draft" use:enhance>
			<input type="hidden" name="locale" value={row.locale} />
			<button class="w-full rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800">{m.journal_state_draft()}</button>
		</form>
	{/if}
	</div>
{:else}
	<div class="flex flex-wrap items-center gap-2.5 rounded-lg border border-dashed border-zinc-800 px-3 py-2">
		<JournalCaliberBadge {caliber} />
		<span class="text-xs text-zinc-500 italic">{m.journal_no_version()}</span>
	</div>
{/if}
