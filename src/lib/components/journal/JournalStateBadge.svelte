<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	/** What readers see vs. what editors are working on, in one badge. */
	let {
		status,
		revision,
		published_revision,
		approvals = 0,
		required = 1
	}: {
		status: 'draft' | 'human_approved' | 'flagged';
		revision: number;
		published_revision: number | null;
		/** Approvals of the current revision that count. */
		approvals?: number;
		required?: number;
	} = $props();
	// Ready = enough approvals right now (the stored status can lag behind a changed JOURNAL_HEAVY_REVIEWERS).
	const ready = $derived(status !== 'flagged' && approvals >= required);

	const live = $derived(published_revision !== null);
	const liveIsCurrent = $derived(published_revision === revision);
	const label = $derived(
		live
			? liveIsCurrent
				? m.journal_state_live()
				: m.journal_state_live_newer({ revision })
			: ready
				? m.journal_state_ready()
				: status === 'flagged'
					? m.journal_state_flagged()
					: approvals > 0
						? m.journal_state_in_review()
						: m.journal_state_draft()
	);
	const tone = $derived(
		live && liveIsCurrent
			? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
			: status === 'flagged'
				? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
				: ready || live || approvals > 0
					? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
					: 'border-zinc-700 bg-zinc-800/60 text-zinc-300'
	);
</script>

<span class="inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap {tone}">{label}</span>
