<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { EditorRow } from '$lib/server/journal';
	import JournalCaliberBadge from './JournalCaliberBadge.svelte';
	import JournalStateBadge from './JournalStateBadge.svelte';

	/** One version of a rozprawe in the back-office: opens its editor; shows its state and approvals, or that it does not exist yet. */
	let { row, caliber }: { row: EditorRow | null; caliber: 'light' | 'heavy' } = $props();
</script>

{#if row}
	<a href="/redakcja/{row.id}?lang={row.locale}" class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 transition hover:border-zinc-600 hover:bg-zinc-800/50">
		<JournalCaliberBadge caliber={row.caliber} />
		<JournalStateBadge status={row.status} revision={row.revision} published_revision={row.published_revision} approvals={row.approvals} required={row.required} />
		<span class="font-mono text-[11px] text-zinc-400" title={m.journal_approvals_hint()}>{m.journal_approvals_count({ have: row.approvals, need: row.required })}</span>
	</a>
{:else}
	<div class="flex flex-wrap items-center gap-2.5 rounded-lg border border-dashed border-zinc-800 px-3 py-2">
		<JournalCaliberBadge {caliber} />
		<span class="text-xs text-zinc-500 italic">{m.journal_no_version()}</span>
	</div>
{/if}
