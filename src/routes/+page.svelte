<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleAlert, Info, TriangleAlert } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { languageLabel, reviewLabel } from '$lib/i18n/labels';

	let { data, form } = $props();
	const d = $derived(data.dash);

	const warnText = (id: string): string => {
		const fn = (m as unknown as Record<string, () => string>)[`warn_${id}`];
		return typeof fn === 'function' ? fn() : id;
	};
	const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
	const kib = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MiB` : `${Math.max(1, Math.round(b / 1024))} KiB`);
	const ago = (h: number | null) => (h === null ? '—' : h < 1 ? m.dash_minutes_ago({ n: Math.max(1, Math.round(h * 60)) }) : h < 48 ? m.dash_hours_ago({ n: Math.round(h) }) : m.dash_days_ago({ n: Math.round(h / 24) }));

	const tiles = $derived([
		{ label: m.dash_sources(), value: d.counts.sources },
		{ label: m.dash_arguments(), value: d.counts.arguments },
		{ label: m.dash_approved(), value: d.counts.approvedTexts },
		{ label: m.content_title(), value: d.counts.drafts },
		{ label: m.dash_users(), value: d.counts.users }
	]);
	const queueRows = $derived([
		{ label: m.review_reason_flagged(), n: d.queue.flagged, tone: 'text-amber-300' },
		{ label: m.review_reason_stale(), n: d.queue.stale, tone: 'text-rose-300' },
		{ label: m.review_reason_sampled(), n: d.queue.sampled, tone: 'text-sky-300' },
		{ label: m.review_reason_draft(), n: d.queue.draft, tone: 'text-zinc-300' }
	]);
	const errors = $derived((form && 'errors' in form ? (form.errors as string[]) : []) ?? []);
	const card = 'rounded-xl border border-zinc-800 bg-zinc-900/40 p-4';
	const yes = (b: boolean) => (b ? m.dash_yes() : m.dash_no());
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">{m.dash_title()}</h1>
		<p class="mt-1 text-sm text-zinc-400">{m.dash_intro()}</p>
	</div>

	{#if d.warnings.length}
		<section aria-label={m.dash_attention()} class="space-y-2">
			{#each d.warnings as w (w.id)}
				<div role={w.severity === 'error' ? 'alert' : 'status'} class="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm
					{w.severity === 'error' ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : w.severity === 'warn' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-sky-500/30 bg-sky-500/5 text-sky-200'}">
					{#if w.severity === 'error'}<CircleAlert class="mt-0.5 h-4 w-4 shrink-0" />{:else if w.severity === 'warn'}<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />{:else}<Info class="mt-0.5 h-4 w-4 shrink-0" />{/if}
					<span>{warnText(w.id)}</span>
				</div>
			{/each}
		</section>
	{/if}

	<div class="grid grid-cols-2 gap-4 md:grid-cols-5">
		{#each tiles as tile (tile.label)}
			<div class={card}><div class="text-3xl font-bold text-amber-400">{tile.value}</div><div class="mt-1 text-xs text-zinc-400">{tile.label}</div></div>
		{/each}
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		<section class={card}>
			<div class="flex items-baseline justify-between"><h2 class="font-semibold">{m.dash_queue()}</h2><a href="/review" class="text-xs text-sky-400 hover:underline">{m.dash_open_review()}</a></div>
			<ul class="mt-3 space-y-1 text-sm">{#each queueRows as r (r.label)}<li class="flex justify-between"><span class="text-zinc-400">{r.label}</span><span class="font-mono {r.n ? r.tone : 'text-zinc-600'}">{r.n}</span></li>{/each}</ul>
		</section>

		<section class={card}>
			<h2 class="font-semibold">{m.dash_sampling()}</h2>
			<p class="mt-2 text-sm text-zinc-300">{m.review_stats_line({ reviewed: d.sampling.reviewed, disagreed: d.sampling.disagreed, rate: Math.round(d.sampling.rate * 100) })}</p>
			<p class="mt-1 text-xs {d.sampling.alert ? 'text-rose-300' : 'text-zinc-500'}">{d.sampling.alert ? m.review_alert() : m.dash_sampling_ok()}</p>
		</section>

		<section class={card}>
			<h2 class="font-semibold">{m.dash_pipeline()}</h2>
			<dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
				<dt class="text-zinc-400">{m.dash_runs()}</dt><dd class="text-right font-mono">{d.pipeline.runs30d}</dd>
				<dt class="text-zinc-400">{m.dash_cards_created()}</dt><dd class="text-right font-mono">{d.pipeline.created}</dd>
				<dt class="text-zinc-400">{m.dash_fabrication()}</dt><dd class="text-right font-mono {d.pipeline.fabricationRate && d.pipeline.fabricationRate > 0.3 ? 'text-rose-300' : ''}">{pct(d.pipeline.fabricationRate)}</dd>
				<dt class="text-zinc-400">{m.dash_ai_verified()}</dt><dd class="text-right font-mono">{d.pipeline.verified}</dd>
				<dt class="text-zinc-400">{m.dash_flagged()}</dt><dd class="text-right font-mono">{d.pipeline.flagged}</dd>
			</dl>
			{#if d.pipeline.last}<p class="mt-2 text-xs text-zinc-500">{m.dash_last_run()}: {d.pipeline.last.at} · {d.pipeline.last.drafter ?? '—'} → {d.pipeline.last.auditor ?? '—'}</p>{/if}
		</section>

		<section class={card}>
			<h2 class="font-semibold">{m.repo_coverage()}</h2>
			<div class="mt-3 space-y-3">
				{#each Object.entries(d.coverage) as [code, c] (code)}
					<div><div class="flex justify-between text-sm"><span>{languageLabel(code)}</span><span class="text-zinc-400">{c.translated}/{c.total} · {c.approved} {m.repo_approved()}</span></div>
						<div class="mt-1 h-1.5 rounded bg-zinc-800"><div class="h-1.5 rounded bg-amber-500" style="width: {c.percentage}%"></div></div></div>
				{/each}
			</div>
		</section>

		<section class={card}>
			<h2 class="font-semibold">{m.dash_backup()}</h2>
			{#if d.backup.last}
				<p class="mt-2 text-sm">{m.dash_last_backup()}: <span class="font-mono">{d.backup.last.file}</span> ({kib(d.backup.last.bytes)}, {ago(d.backup.ageHours)})</p>
			{:else}<p class="mt-2 text-sm text-rose-300">{m.dash_no_backup()}</p>{/if}
			<p class="mt-1 text-xs text-zinc-500">{m.dash_backup_info({ n: d.backup.count, hours: d.backup.intervalHours, dir: d.backup.dir })}</p>
			{#if data.isAdmin}
				<form method="POST" action="?/backup" use:enhance class="mt-3 flex items-center gap-3">
					<button class="rounded border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800">{m.dash_backup_now()}</button>
					{#if form && 'backedUp' in form}<span class="text-xs text-emerald-300">{form.backedUp}</span>{/if}
				</form>
			{/if}
			{#each errors as e (e)}<p role="alert" class="mt-2 text-xs text-rose-300">{e}</p>{/each}
		</section>

		<section class={card}>
			<h2 class="font-semibold">{m.dash_config()}</h2>
			<dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
				<dt class="text-zinc-400">{m.dash_cfg_auth()}</dt><dd class="text-right">{d.config.auth === 'enabled' ? m.dash_on() : m.dash_off()}</dd>
				<dt class="text-zinc-400">{m.dash_cfg_chat()}</dt><dd class="text-right">{yes(d.config.chat)}</dd>
				<dt class="text-zinc-400">{m.dash_cfg_drafter()}</dt><dd class="text-right">{yes(d.config.drafter)}</dd>
				<dt class="text-zinc-400">{m.dash_cfg_auditor()}</dt><dd class="text-right">{yes(d.config.auditor)}</dd>
				<dt class="text-zinc-400">{m.dash_cfg_embedder()}</dt><dd class="text-right font-mono">{d.config.embedder}</dd>
				<dt class="text-zinc-400">RAG_VECTOR_MIN</dt><dd class="text-right font-mono">{d.config.ragVectorMin}</dd>
			</dl>
		</section>

		<section class={card}>
			<h2 class="font-semibold">{m.dash_top_used()}</h2>
			<ul class="mt-3 space-y-1 text-sm">
				{#each d.topUsed as t (`${t.ownerType}:${t.ownerId}`)}<li class="flex justify-between gap-3"><span class="truncate text-zinc-300">{t.title}</span><span class="font-mono text-zinc-500">{t.uses}×</span></li>
				{:else}<li class="text-zinc-500">{m.dash_no_usage()}</li>{/each}
			</ul>
		</section>

		<section class={card}>
			<h2 class="font-semibold">{m.dash_recent()}</h2>
			<ul class="mt-3 space-y-1 text-xs text-zinc-400">
				{#each d.recent as e, i (i)}<li>{e.at} · {e.actor} · #{e.ownerId} {e.locale}: {reviewLabel(e.from)} → {reviewLabel(e.to)}</li>
				{:else}<li class="text-zinc-500">{m.dash_no_activity()}</li>{/each}
			</ul>
		</section>
	</div>
</div>
