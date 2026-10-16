<script lang="ts">
	import { enhance } from '$app/forms';
	import { CheckSquare, Image, Music2 } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';
	import ReviewBadge from '$lib/components/ReviewBadge.svelte';
	import { languageLabel, mediaStatusLabel } from '$lib/i18n/labels';

	let { data, form } = $props();
	let selectedKeys = $state<string[]>([]);

	const errors = $derived((form && 'errors' in form ? (form.errors as string[]) : []) ?? []);
	const reindexed = $derived(form && 'reindexed' in form ? form.reindexed : undefined);
	const reasonLabel = (r: string) =>
		({
			flagged: m.review_reason_flagged(),
			stale: m.review_reason_stale(),
			draft: m.review_reason_draft(),
			sampled: m.review_reason_sampled()
		})[r] ?? r;
	const rate = $derived(Math.round(data.stats.rate * 100));

	function toggleAllSources() {
		const sourceKeys = data.queue.filter((i) => i.ownerType === 'source').map((i) => `${i.ownerType}:${i.ownerId}:${i.locale}`);
		if (sourceKeys.every((k) => selectedKeys.includes(k))) {
			selectedKeys = selectedKeys.filter((k) => !sourceKeys.includes(k));
		} else {
			selectedKeys = [...new Set([...selectedKeys, ...sourceKeys])];
		}
	}

	/** Splits sourceText into [before, matchedSpan, after] for inline quote verification. */
	function splitHighlight(sourceText: string, span: string): { before: string; match: string; after: string } | null {
		if (!span || !sourceText) return null;
		const idx = sourceText.toLowerCase().indexOf(span.toLowerCase());
		if (idx === -1) return null;
		return {
			before: sourceText.slice(0, idx),
			match: sourceText.slice(idx, idx + span.length),
			after: sourceText.slice(idx + span.length)
		};
	}
</script>

<div class="space-y-8">
	<div class="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-6">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{m.review_title()}</h1>
			<p class="mt-1 text-sm text-zinc-400">{m.review_intro()}</p>
		</div>

		{#if data.queue.length > 0}
			<form method="POST" action="?/batchApprove" use:enhance={() => async ({ update }) => { await update(); selectedKeys = []; }} class="flex flex-wrap items-center gap-2">
				{#each selectedKeys as k (k)}
					<input type="hidden" name="selected_items" value={k} />
				{/each}
				<button
					type="button"
					onclick={toggleAllSources}
					class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
				>
					Zaznacz źródła ({data.queue.filter((i) => i.ownerType === 'source').length})
				</button>
				<button
					type="submit"
					disabled={selectedKeys.length === 0}
					class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
				>
					<CheckSquare class="h-3.5 w-3.5" />
					{m.repo_approve()} ({selectedKeys.length})
				</button>
			</form>
		{/if}
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
			{@const itemKey = `${item.ownerType}:${item.ownerId}:${item.locale}`}
			<article class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
				<div class="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
					<input
						type="checkbox"
						value={itemKey}
						checked={selectedKeys.includes(itemKey)}
						onchange={(e) => {
							const checked = (e.currentTarget as HTMLInputElement).checked;
							selectedKeys = checked ? [...selectedKeys, itemKey] : selectedKeys.filter((k) => k !== itemKey);
						}}
						aria-label={item.title}
					/>
					<span class="rounded bg-zinc-800 px-2 py-0.5">{reasonLabel(item.reason)}</span>
					<span>{item.ownerType === 'source' ? m.review_kind_source() : m.review_kind_argument()} #{item.ownerId}</span>
					<span>{languageLabel(item.locale)}</span>
					<ReviewBadge state={item.review} />
					<span>{m.review_uses({ n: item.uses })}</span>
				</div>
				<h2 class="mt-2 font-semibold">{item.title}</h2>
				<p class="mt-1 whitespace-pre-line text-sm text-zinc-300">{item.body}</p>

				<!-- Inline Source-Span Quote Highlighting for Argument Cards -->
				{#if item.spans && item.spans.length > 0}
					<div class="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-xs">
						<div class="font-semibold uppercase tracking-wide text-amber-400">{m.arg_sources_label()} (Inline Span Verification)</div>
						{#each item.spans as sp, idx (idx)}
							{@const hl = splitHighlight(sp.sourceText, sp.span)}
							<div class="space-y-1 border-l-2 border-amber-500/40 pl-2.5">
								<div class="font-semibold text-zinc-200">{sp.sourceTitle}</div>
								{#if hl}
									<p class="leading-relaxed text-zinc-400">
										{hl.before}<mark class="rounded bg-emerald-500/25 px-1 font-medium text-emerald-200">{hl.match}</mark>{hl.after}
									</p>
								{:else if sp.sourceText}
									<p class="leading-relaxed text-zinc-400">{sp.sourceText}</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				{#if item.auditNotes}
					<details class="mt-2">
						<summary class="cursor-pointer text-xs text-zinc-400">{m.review_audit_notes()}</summary>
						<pre class="mt-1 whitespace-pre-wrap rounded bg-zinc-950 p-2 text-xs text-zinc-400">{item.auditNotes}</pre>
					</details>
				{/if}
				<div class="mt-3 flex flex-wrap gap-2">
					{#each [['human_approved', m.repo_approve()], ['flagged', m.repo_flag()], ['draft', m.repo_to_draft()]] as [to, label] (to)}
						{#if item.review !== to}
							<form method="POST" action="?/review" use:enhance>
								<input type="hidden" name="ownerType" value={item.ownerType} />
								<input type="hidden" name="ownerId" value={item.ownerId} />
								<input type="hidden" name="locale" value={item.locale} />
								<input type="hidden" name="to" value={to} />
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

	<!-- Pending Media & Campaign Posters in Review Queue -->
	{#if (data.pendingPosters && data.pendingPosters.length > 0) || (data.pendingMedia && data.pendingMedia.length > 0)}
		<section class="space-y-4 border-t border-zinc-800 pt-6">
			<h2 class="text-xl font-bold text-zinc-100">{m.dash_media_posters()} — {m.dash_to_review()}</h2>
			<div class="grid gap-4 md:grid-cols-2">
				{#each data.pendingPosters ?? [] as p (p.id)}
					<article class="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
						<img src={p.image_path} alt={p.title} class="h-20 w-28 shrink-0 rounded-lg object-cover" loading="lazy" />
						<div class="flex flex-1 flex-col justify-between text-xs">
							<div>
								<div class="font-semibold text-zinc-100">{p.title}</div>
								<div class="text-zinc-400">{p.image_path} · {mediaStatusLabel(p.status)}</div>
							</div>
							<div class="mt-2 flex gap-2">
								<form method="POST" action="?/posterStatus" use:enhance>
									<input type="hidden" name="posterId" value={p.id} />
									<input type="hidden" name="to" value="human_approved" />
									<button class="rounded bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-500">{m.media_approve()}</button>
								</form>
								<form method="POST" action="?/posterStatus" use:enhance>
									<input type="hidden" name="posterId" value={p.id} />
									<input type="hidden" name="to" value="flagged" />
									<button class="rounded border border-amber-500/40 px-2.5 py-1 text-amber-300">{m.media_flag()}</button>
								</form>
							</div>
						</div>
					</article>
				{/each}
				{#each data.pendingMedia ?? [] as item (item.id)}
					<article class="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
						<div class="flex items-center gap-2.5">
							<Music2 class="h-5 w-5 shrink-0 text-amber-400" />
							<div>
								<div class="font-semibold text-zinc-100">{item.title}</div>
								<div class="text-zinc-400">{item.artist_or_author} · {mediaStatusLabel(item.status)}</div>
							</div>
						</div>
						<div class="flex gap-2">
							<form method="POST" action="?/mediaStatus" use:enhance>
								<input type="hidden" name="mediaId" value={item.id} />
								<input type="hidden" name="to" value="human_approved" />
								<button class="rounded bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-500">{m.media_approve()}</button>
							</form>
							<a href="/media?select={item.id}" class="rounded border border-zinc-700 px-2.5 py-1 text-zinc-300 hover:bg-zinc-800">
								<Image class=" inline h-3 w-3" /> /media
							</a>
						</div>
					</article>
				{/each}
			</div>
		</section>
	{/if}
</div>
