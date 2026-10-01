<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages.js';
	import ReviewBadge from '$lib/components/ReviewBadge.svelte';
	import { languageLabel } from '$lib/i18n/labels';

	let { data, form } = $props();

	const errors = $derived((form && 'errors' in form ? (form.errors as string[]) : []) ?? []);
	const reindexed = $derived(form && 'reindexed' in form ? form.reindexed : undefined);
	const reasonLabel = (r: string) =>
		({ flagged: m.review_reason_flagged(), stale: m.review_reason_stale(), draft: m.review_reason_draft(), sampled: m.review_reason_sampled() })[r] ?? r;
	const rate = $derived(Math.round(data.stats.rate * 100));
</script>

<div class="space-y-8">
	<div class="border-b border-zinc-800 pb-6">
		<h1 class="text-3xl font-bold tracking-tight">{m.review_title()}</h1>
		<p class="mt-1 text-sm text-zinc-400">{m.review_intro()}</p>
	</div>

	{#if errors.length}
		<ul role="alert" class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
			{#each errors as e (e)}<li>{e}</li>{/each}
		</ul>
	{/if}

	<section class="rounded-xl border p-4 {data.stats.alert ? 'border-rose-500/50 bg-rose-500/10' : 'border-zinc-800 bg-zinc-900/40'}">
		<h2 class="font-semibold">{m.review_stats_title()}</h2>
		<p class="mt-1 text-sm text-zinc-300">{m.review_stats_line({ reviewed: data.stats.reviewed, disagreed: data.stats.disagreed, rate })}</p>
		{#if data.stats.alert}<p role="alert" class="mt-2 text-sm text-rose-300">{m.review_alert()}</p>{/if}
		{#if data.isAdmin}
			<form method="POST" action="?/reindex" use:enhance class="mt-3">
				<button class="rounded border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800">{m.review_reindex()}</button>
				{#if reindexed === null}<span class="ml-3 text-xs text-zinc-400">{m.review_reindex_off()}</span>
				{:else if typeof reindexed === 'number'}<span class="ml-3 text-xs text-emerald-300">{m.review_reindex_result({ n: reindexed })}</span>{/if}
			</form>
		{/if}
	</section>

	<div class="space-y-3">
		{#each data.queue as item (`${item.ownerType}:${item.ownerId}:${item.locale}`)}
			<article class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
				<div class="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
					<span class="rounded bg-zinc-800 px-2 py-0.5">{reasonLabel(item.reason)}</span>
					<span>{item.ownerType === 'source' ? m.review_kind_source() : m.review_kind_argument()} #{item.ownerId}</span>
					<span>{languageLabel(item.locale)}</span>
					<ReviewBadge state={item.review} />
					<span>{m.review_uses({ n: item.uses })}</span>
				</div>
				<h2 class="mt-2 font-semibold">{item.title}</h2>
				<p class="mt-1 whitespace-pre-line text-sm text-zinc-300">{item.body}</p>
				{#if item.auditNotes}
					<details class="mt-2"><summary class="cursor-pointer text-xs text-zinc-400">{m.review_audit_notes()}</summary>
						<pre class="mt-1 whitespace-pre-wrap rounded bg-zinc-950 p-2 text-xs text-zinc-400">{item.auditNotes}</pre></details>
				{/if}
				<div class="mt-3 flex flex-wrap gap-2">
					{#each [['human_approved', m.repo_approve()], ['flagged', m.repo_flag()], ['draft', m.repo_to_draft()]] as [to, label] (to)}
						{#if item.review !== to}
							<form method="POST" action="?/review" use:enhance>
								<input type="hidden" name="ownerType" value={item.ownerType} /><input type="hidden" name="ownerId" value={item.ownerId} />
								<input type="hidden" name="locale" value={item.locale} /><input type="hidden" name="to" value={to} />
								<button class="rounded border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800 {to === 'human_approved' ? 'text-emerald-300' : ''}">{label}</button>
							</form>
						{/if}
					{/each}
				</div>
			</article>
		{:else}
			<p class="text-sm text-zinc-500">{m.review_empty()}</p>
		{/each}
	</div>
</div>
