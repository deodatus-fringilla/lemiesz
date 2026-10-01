<script lang="ts">
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
	import { Check, Copy, Download, ExternalLink, TriangleAlert, X } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';
	import ReviewBadge from '$lib/components/ReviewBadge.svelte';
	import { checkLabel, languageLabel, platformLabel, toneLabel } from '$lib/i18n/labels';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import type { ContentEvent } from '$lib/server/content/generate';
	import type { Check as CheckResult } from '$lib/server/content/checks';

	type Evidence = Extract<ContentEvent, { type: 'sources' }>;
	let { data, form } = $props();

	let platform = $state('x');
	let tone = $state('');
	let brief = $state('');
	let allowAiVerified = $state(false);
	let busy = $state(false);
	let body = $state('');
	let draftId = $state<number | null>(null);
	let status = $state<'draft' | 'reviewed'>('draft');
	let watermark = $state(false);
	let reviewedBy = $state<string | null>(null);
	let checks = $state<CheckResult[]>([]);
	let evidence = $state<Evidence | null>(null);
	let notice = $state('');
	let copied = $state(false);
	let draftLocale = $state(getLocale());

	// Open a stored draft (?d=id) or reflect the result of save/review actions.
	$effect(() => {
		const d = data.draft;
		if (!d) return;
		draftId = d.id;
		body = d.body;
		status = d.status;
		watermark = d.watermark;
		reviewedBy = d.reviewed_by;
		checks = d.checks;
		platform = d.platform;
		draftLocale = d.locale as typeof draftLocale;
		evidence = null;
	});

	const errors = $derived((form && 'errors' in form ? (form.errors as string[]) : []) ?? []);
	const evidenceSources = $derived(evidence?.sources ?? []);
	const savedSources = $derived(data.draft?.sources ?? []);

	// Live per-post counter for X threads (same rule as the server check: code points per post).
	const posts = $derived(
		platform === 'x' ? body.split(/^\s*---\s*$/m).map((p) => p.trim()).filter(Boolean).map((p) => Array.from(p).length) : []
	);

	function detail(c: CheckResult): string {
		if (c.ok || !c.detail) return '';
		if (c.id === 'x_post_length') return c.detail.split(',').map((x) => x.replace(':', ' → ')).join(', ');
		return c.detail;
	}

	async function generate() {
		if (busy || !brief.trim()) return;
		busy = true;
		notice = '';
		body = '';
		checks = [];
		draftId = null;
		status = 'draft';
		reviewedBy = null;
		try {
			const res = await fetch('/api/content', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ platform, tone: tone || undefined, brief, allowAiVerified })
			});
			if (!res.ok || !res.body) throw new Error(String(res.status));
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				let sep: number;
				while ((sep = buffer.indexOf('\n\n')) !== -1) {
					const block = buffer.slice(0, sep);
					buffer = buffer.slice(sep + 2);
					const line = block.split('\n').find((l) => l.startsWith('data:'));
					if (!line) continue;
					const e = JSON.parse(line.slice(5)) as ContentEvent;
					if (e.type === 'sources') {
						evidence = e;
						draftLocale = e.outputLocale;
					} else if (e.type === 'token') body += e.text;
					else if (e.type === 'done') {
						draftId = e.draftId;
						watermark = e.watermark;
						checks = e.checks;
						if (e.draftId) replaceState(`/content?d=${e.draftId}`, {});
					} else if (e.type === 'error') {
						notice = e.code === 'llm_not_configured' ? m.content_not_configured() : m.content_error();
					}
				}
			}
		} catch {
			notice = m.content_error();
		} finally {
			busy = false;
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(body);
		} catch {
			// navigator.clipboard needs a secure context; plain http over Tailscale is not one.
			const ta = document.createElement('textarea');
			ta.value = body;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			ta.remove();
		}
		copied = true;
		setTimeout(() => (copied = false), 1800);
	}

	const field = 'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm';
</script>

<div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
	<section class="space-y-5">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{m.content_title()}</h1>
			<p class="mt-1 text-sm text-zinc-400">{m.content_intro()}</p>
		</div>

		<form onsubmit={(e) => { e.preventDefault(); generate(); }} class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="block text-sm"><span class="mb-1 block text-zinc-300">{m.content_platform()}</span>
					<select bind:value={platform} class={field}>{#each data.platforms as p (p)}<option value={p}>{platformLabel(p)}</option>{/each}</select></label>
				<label class="block text-sm"><span class="mb-1 block text-zinc-300">{m.content_tone()}</span>
					<select bind:value={tone} class={field}>
						<option value="">{toneLabel(data.defaultTones[platform as keyof typeof data.defaultTones])} ✓</option>
						{#each data.tones as t (t)}<option value={t}>{toneLabel(t)}</option>{/each}
					</select></label>
			</div>
			<label class="block text-sm"><span class="mb-1 block text-zinc-300">{m.content_brief()}</span>
				<textarea bind:value={brief} rows="3" maxlength={data.maxBrief} placeholder={m.content_brief_placeholder()} class={field}></textarea></label>
			<label class="flex items-start gap-2 text-xs text-zinc-400"><input type="checkbox" bind:checked={allowAiVerified} class="mt-0.5" />
				<span>{m.content_allow_ai()}<br /><span class="text-zinc-500">{m.content_allow_ai_hint()}</span></span></label>
			{#if !data.chatConfigured}<p class="text-xs text-amber-300">{m.content_not_configured()}</p>{/if}
			<button disabled={busy || !brief.trim()} class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
				{busy ? m.content_generating() : m.content_generate()}</button>
		</form>

		{#if notice}<p role="alert" class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{notice}</p>{/if}
		{#if errors.length}
			<ul role="alert" class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{#each errors as e (e)}<li>{e}</li>{/each}</ul>
		{/if}

		{#if body || busy}
			<div class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
				<div class="flex flex-wrap items-center gap-2 text-xs">
					<span class="font-semibold uppercase tracking-wide text-amber-400">{m.content_draft()}</span>
					<span class="rounded bg-zinc-800 px-2 py-0.5">{platformLabel(platform)}</span>
					<span class="rounded bg-zinc-800 px-2 py-0.5">{languageLabel(draftLocale)}</span>
					<span class="rounded px-2 py-0.5 {status === 'reviewed' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-800 text-zinc-300'}">
						{status === 'reviewed' ? m.content_status_reviewed() : m.content_status_draft()}</span>
					{#if status === 'reviewed' && reviewedBy}<span class="text-zinc-500">{m.content_reviewed_by({ user: reviewedBy })}</span>{/if}
					{#if watermark}<span class="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-amber-300"><TriangleAlert class="h-3 w-3" />{m.content_unreviewed_material()}</span>{/if}
				</div>

				<form method="POST" use:enhance={() => async ({ update }) => { await update({ reset: false }); }} class="space-y-3">
					<input type="hidden" name="draftId" value={draftId ?? ''} />
					<textarea name="body" bind:value={body} rows="14" readonly={busy}
						class="{field} font-mono leading-relaxed {watermark ? 'border-amber-500/50' : ''}"></textarea>
					{#if platform === 'x' && posts.length}
						<p class="flex flex-wrap gap-2 text-xs">
							{#each posts as n, i (i)}<span class="rounded px-2 py-0.5 {n > 280 ? 'bg-rose-500/20 text-rose-300' : 'bg-zinc-800 text-zinc-400'}">{i + 1}: {n}/280</span>{/each}
						</p>
					{/if}
					<p class="text-xs text-zinc-500">{m.content_edit_hint()}</p>

					<div class="flex flex-wrap items-center gap-2">
						<button type="button" onclick={copy} disabled={!body} class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800">
							{#if copied}<Check class="h-4 w-4 text-emerald-400" />{m.content_copied()}{:else}<Copy class="h-4 w-4" />{m.content_copy()}{/if}</button>
						{#if draftId}
							<a href="/content/export/{draftId}" class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"><Download class="h-4 w-4" />{m.content_export()}</a>
							<button formaction="?/save" class="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800">{m.content_save()}</button>
							{#if status !== 'reviewed'}
								<button formaction="?/review" class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500">{m.content_review()}</button>
							{/if}
							<button formaction="?/delete" class="ml-auto inline-flex items-center gap-1 text-xs text-rose-400 hover:underline"
								onclick={(e) => { if (!confirm(m.content_delete_confirm())) e.preventDefault(); }}><X class="h-3 w-3" />{m.repo_delete()}</button>
						{/if}
					</div>
				</form>

				{#if checks.length}
					<div>
						<h3 class="mb-1 text-sm font-semibold text-zinc-300">{m.content_checks()}</h3>
						<ul class="space-y-1 text-xs">
							{#each checks as c (c.id)}
								<li class="flex items-start gap-2 {c.ok ? 'text-zinc-400' : 'text-rose-300'}">
									{#if c.ok}<Check class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />{:else}<TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />{/if}
									<span>{checkLabel(c.id)}{#if detail(c)} <span class="font-mono">({detail(c)})</span>{/if}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}
	</section>

	<aside class="space-y-4 lg:sticky lg:top-24 lg:self-start">
		<h2 class="text-lg font-semibold">{m.shield_evidence()}</h2>
		{#if evidence}
			<p class="rounded-lg border px-3 py-2 text-sm {evidence.tier === 'none' ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}">
				{evidence.tier === 'arguments' ? m.shield_tier_arguments() : evidence.tier === 'sources' ? m.shield_tier_sources() : m.shield_tier_none()}</p>
		{/if}
		{#each evidence ? evidenceSources : savedSources as s (s.id)}
			<article class="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
				<div class="flex flex-wrap items-center gap-2"><span class="font-semibold">{s.work} {s.section_ref}</span><ReviewBadge state={s.review} /></div>
				<blockquote class="whitespace-pre-line text-zinc-300">{s.text}</blockquote>
				<div class="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
					<span>{m.repo_license()}: {s.license}</span>
					{#if s.url}<a href={s.url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-sky-400 hover:underline"><ExternalLink class="h-3 w-3" />{m.repo_open_source()}</a>{/if}
				</div>
			</article>
		{:else}
			{#if !evidence}<p class="text-sm text-zinc-500">{m.shield_evidence_empty()}</p>{/if}
		{/each}

		<h2 class="pt-2 text-lg font-semibold">{m.content_recent()}</h2>
		<ul class="space-y-2 text-sm">
			{#each data.recent as d (d.id)}
				<li><a href="/content?d={d.id}" class="block rounded-lg border border-zinc-800 px-3 py-2 hover:bg-zinc-900">
					<span class="flex flex-wrap items-center gap-2 text-xs text-zinc-400"><span>{platformLabel(d.platform)}</span><span>{languageLabel(d.locale)}</span>
						<span class={d.status === 'reviewed' ? 'text-emerald-300' : ''}>{d.status === 'reviewed' ? m.content_status_reviewed() : m.content_status_draft()}</span>
						{#if d.watermark}<TriangleAlert class="h-3 w-3 text-amber-300" />{/if}<span>{m.content_by({ user: d.created_by })}</span></span>
					<span class="mt-0.5 block truncate">{d.brief}</span></a></li>
			{:else}<li class="text-zinc-500">{m.content_none()}</li>{/each}
		</ul>
	</aside>
</div>
