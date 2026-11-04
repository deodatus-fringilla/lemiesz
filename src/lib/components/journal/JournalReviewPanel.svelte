<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages.js';
	import type { ArticleText } from '$lib/server/journal';
	import JournalStateBadge from './JournalStateBadge.svelte';

	/**
	 * Review → publish for one language. Approvals belong to the current revision; the published version stays online
	 * while a newer revision waits for approval.
	 */
	let {
		text,
		locale,
		approvals,
		counted,
		required,
		me,
		blocked
	}: {
		text: ArticleText;
		locale: string;
		approvals: { approved_by: string; approved_at: string }[];
		/** Approvals that count (a development-mode "dev" approval does not once real accounts are on). */
		counted: number;
		required: number;
		me: string;
		/** Unresolved citations: approving is refused by the server, so the button says why up front. */
		blocked: boolean;
	} = $props();

	const iApproved = $derived(approvals.some((a) => a.approved_by === me));
	const canPublish = $derived(text.status === 'human_approved' && counted >= required && text.published_revision !== text.revision);
	const missing = $derived(Math.max(0, required - counted));
	const btn = 'w-full rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40';
</script>

<section class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
	<div class="space-y-2">
		<h3 class="text-xs font-semibold tracking-wider text-zinc-400 uppercase">{m.journal_review()}</h3>
		<JournalStateBadge status={text.status} revision={text.revision} published_revision={text.published_revision} approvals={approvals.length} />
	</div>
	<p class="text-xs text-zinc-300">
		{m.journal_approvals_count({ have: counted, need: required })}
		{#if approvals.length}<span class="text-zinc-500">· {approvals.map((a) => a.approved_by).join(', ')}</span>{/if}
	</p>
	{#if text.published_at}
		<p class="text-[11px] text-zinc-500">{m.journal_live_since({ revision: text.published_revision ?? 0, date: text.published_at.slice(0, 16), by: text.published_by ?? '' })}</p>
	{/if}

	<form method="POST" action="?/approve" use:enhance>
		<input type="hidden" name="locale" value={locale} />
		<button class="{btn} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20" disabled={iApproved || blocked || text.status === 'flagged'}>
			{iApproved ? m.journal_approved_by_you() : m.journal_approve_revision({ revision: text.revision })}
		</button>
	</form>
	{#if blocked}<p class="text-[11px] text-rose-300">{m.journal_blocked_citations()}</p>{/if}
	{#if text.status === 'flagged'}<p class="text-[11px] text-rose-300">{m.journal_flagged_hint()}</p>{/if}

	<form method="POST" action="?/publish" use:enhance>
		<input type="hidden" name="locale" value={locale} />
		<button class="{btn} {canPublish ? 'border-amber-500/50 bg-amber-500 text-zinc-950 hover:bg-amber-400' : 'border-zinc-700 bg-zinc-800 text-zinc-400'}" disabled={!canPublish}>{m.journal_publish()}</button>
	</form>
	{#if missing > 0 && text.status !== 'flagged'}<p class="text-[11px] text-zinc-400">{m.journal_needs_more({ count: missing })}</p>{/if}
	{#if counted < approvals.length}<p class="text-[11px] text-zinc-500">{m.journal_dev_not_counted()}</p>{/if}

	<div class="flex gap-2">
		{#if text.status !== 'flagged'}
			<form method="POST" action="?/flag" use:enhance class="flex-1">
				<input type="hidden" name="locale" value={locale} />
				<button class="{btn} border-zinc-700 text-zinc-300 hover:bg-zinc-800">{m.journal_flag()}</button>
			</form>
		{/if}
		{#if text.published_body !== null}
			<form method="POST" action="?/unpublish" use:enhance onsubmit={(e) => !confirm(m.journal_unpublish_confirm()) && e.preventDefault()} class="flex-1">
				<input type="hidden" name="locale" value={locale} />
				<button class="{btn} border-rose-500/30 text-rose-300 hover:bg-rose-500/10">{m.journal_unpublish()}</button>
			</form>
		{/if}
	</div>
</section>
