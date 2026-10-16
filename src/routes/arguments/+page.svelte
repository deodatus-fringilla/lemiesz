<script lang="ts">
	import { enhance } from '$app/forms';
	import { Columns2, PenLine, Plus, Search, Sparkles } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';
	import ReviewBadge from '$lib/components/ReviewBadge.svelte';
	import { languageLabel, originLabel, reviewLabel } from '$lib/i18n/labels';

	let { data, form } = $props();
	let showCreate = $state(false);
	let bilingualView = $state(true);
	let sourceFilter = $state('');

	const errors = $derived((form && 'errors' in form ? (form.errors as string[]) : []) ?? []);
	const summary = $derived(form && 'summary' in form ? form.summary : null);
	const sourceLabel = (id: number) => data.sources.find((s) => s.id === id)?.label ?? `#${id}`;
	const filteredSources = $derived(
		sourceFilter.trim()
			? data.sources.filter((s) => s.label.toLowerCase().includes(sourceFilter.trim().toLowerCase()))
			: data.sources
	);
	const input = 'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm';
	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function debouncedSubmit(formEl: HTMLFormElement | null) {
		if (!formEl) return;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => formEl.requestSubmit(), 300);
	}
</script>

<div class="space-y-8">
	<div class="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-6 md:flex-row md:items-end">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{m.arg_title()}</h1>
			<p class="mt-1 text-sm text-zinc-400">{m.arg_intro()}</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={() => (bilingualView = !bilingualView)}
				class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors {bilingualView
					? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
					: 'border-zinc-700 text-zinc-400 hover:bg-zinc-900'}"
			>
				<Columns2 class="h-4 w-4" />
				{m.bilingual_view_toggle()}
			</button>
			<button
				type="button"
				onclick={() => (showCreate = !showCreate)}
				class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
			>
				<Plus class="h-4 w-4" />{m.arg_add()}
			</button>
		</div>
	</div>

	{#if errors.length}
		<ul role="alert" class="space-y-1 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
			{#each errors as e (e)}<li>{e}</li>{/each}
		</ul>
	{/if}
	{#if summary}
		<p role="status" class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">{m.arg_draft_result(summary)}</p>
	{/if}

	{#if data.isAdmin}
		<section class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
			<h2 class="flex items-center gap-2 font-semibold"><Sparkles class="h-4 w-4 text-amber-400" />{m.arg_draft_title()}</h2>
			<p class="mt-1 text-sm text-zinc-400">{m.arg_draft_intro()}</p>
			{#if data.draftingConfigured}
				<form method="POST" action="?/draft" use:enhance class="mt-3 flex flex-wrap items-end gap-3">
					<label class="text-sm">
						<span class="mb-1 block text-zinc-300">{m.arg_draft_source()}</span>
						<select name="sourceId" class="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
							{#each data.sources as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
						</select>
					</label>
					<label class="text-sm">
						<span class="mb-1 block text-zinc-300">{m.f_locale()}</span>
						<select name="locale" class="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
							{#each data.uiLocales as l (l)}<option value={l} selected={l === data.filters.locale}>{languageLabel(l)}</option>{/each}
						</select>
					</label>
					<label class="text-sm">
						<span class="mb-1 block text-zinc-300">{m.arg_draft_count()}</span>
						<input name="count" type="number" min="1" max="6" value="3" class="w-20 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
					</label>
					<button class="rounded-lg border border-amber-500/50 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/10">{m.arg_draft_run()}</button>
				</form>
			{:else}
				<p class="mt-3 text-sm text-amber-300">{m.arg_draft_unavailable()}</p>
			{/if}
		</section>
	{/if}

	{#if showCreate}
		<form
			method="POST"
			action="?/create"
			use:enhance={() =>
				async ({ result, update }) => {
					await update();
					if (result.type === 'success') showCreate = false;
				}}
			class="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 md:grid-cols-2"
		>
			<label class="block text-sm md:col-span-2">
				<span class="mb-1 block text-zinc-300">{m.f_claim()}</span>
				<textarea name="opponent_claim" rows="2" required class={input}></textarea>
			</label>
			<label class="block text-sm md:col-span-2">
				<span class="mb-1 block text-zinc-300">{m.f_punch()}</span>
				<textarea name="counter_punch" rows="4" required class={input}></textarea>
			</label>
			<label class="block text-sm">
				<span class="mb-1 block text-zinc-300">{m.f_principle()}</span>
				<input name="core_principle" required class={input} />
			</label>
			<label class="block text-sm">
				<span class="mb-1 block text-zinc-300">{m.f_fallacy()}</span>
				<input name="fallacy_type" class={input} />
			</label>
			<label class="block text-sm">
				<span class="mb-1 block text-zinc-300">{m.f_locale()}</span>
				<select name="locale" class={input}>
					{#each data.uiLocales as l (l)}<option value={l} selected={l === data.filters.locale}>{languageLabel(l)}</option>{/each}
				</select>
			</label>
			<label class="block text-sm">
				<span class="mb-1 block text-zinc-300">{m.f_keywords()}</span>
				<input name="keywords" class={input} />
			</label>
			<div class="block text-sm md:col-span-2">
				<div class="mb-1.5 flex items-center justify-between gap-2">
					<span class="text-zinc-300">{m.arg_sources_label()}</span>
					<input
						type="search"
						bind:value={sourceFilter}
						placeholder={m.sources_filter_placeholder()}
						class="w-64 rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs"
					/>
				</div>
				<div class="grid max-h-48 gap-1.5 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 p-3 sm:grid-cols-2">
					{#each filteredSources as s (s.id)}
						<label class="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-xs hover:bg-zinc-900">
							<input type="checkbox" name="source_ids" value={s.id} class="mt-0.5" />
							<span class="text-zinc-200">{s.label}</span>
						</label>
					{/each}
				</div>
			</div>
			<div class="flex gap-3 md:col-span-2">
				<button class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950">{m.repo_save()}</button>
				<button type="button" onclick={() => (showCreate = false)} class="rounded-lg border border-zinc-700 px-4 py-2 text-sm">{m.repo_cancel()}</button>
			</div>
		</form>
	{/if}

	<form method="GET" class="flex flex-wrap items-center gap-3">
		<div class="relative min-w-60 flex-1">
			<Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
			<input
				name="q"
				value={data.filters.q}
				oninput={(e) => debouncedSubmit((e.currentTarget as HTMLInputElement).form)}
				placeholder={m.arg_search()}
				class="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-3 text-sm"
			/>
		</div>
		<select
			name="review"
			onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}
			class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
		>
			<option value="">{m.repo_all()}</option>
			{#each data.reviews as r (r)}<option value={r} selected={data.filters.review === r}>{reviewLabel(r)}</option>{/each}
		</select>
		<select
			name="locale"
			onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}
			class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
		>
			{#each data.uiLocales as l (l)}<option value={l} selected={data.filters.locale === l}>{languageLabel(l)}</option>{/each}
		</select>
		<button class="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">{m.repo_search_submit()}</button>
	</form>

	<div class="space-y-4">
		{#each data.cards as card (card.id)}
			{@const shown = card.activeText}
			{@const textPl = card.texts['pl']}
			{@const textEn = card.texts['en']}
			<article class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
				<div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
					<div class="flex flex-wrap items-center gap-2">
						<span class="rounded bg-amber-500/15 px-2.5 py-0.5 font-semibold text-amber-300">{card.core_principle}</span>
						{#if card.fallacy_type}<span class="rounded bg-zinc-800 px-2 py-0.5 text-zinc-400">{card.fallacy_type}</span>{/if}
					</div>
					{#if shown}
						<a
							href="/content?platform=letter&brief={encodeURIComponent(shown.opponent_claim)}"
							class="inline-flex items-center gap-1 rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
						>
							<PenLine class="h-3 w-3" />{m.shield_to_letter()}
						</a>
					{/if}
				</div>

				{#if bilingualView && (textPl || textEn)}
					<div class="mt-3 grid gap-4 lg:grid-cols-2">
						{#each [textPl, textEn].filter((x) => !!x) as t (t!.locale)}
							<div class="rounded-lg border border-zinc-800/90 bg-zinc-950/50 p-3.5">
								<div class="mb-2 flex items-center justify-between gap-2">
									<span class="rounded bg-zinc-800 px-2 py-0.5 text-xs font-semibold uppercase text-amber-300">{t!.locale} · {languageLabel(t!.locale)}</span>
									<ReviewBadge state={t!.review} />
								</div>
								<h3 class="text-sm font-semibold text-zinc-100">„{t!.opponent_claim}”</h3>
								<p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{t!.counter_punch}</p>
							</div>
						{/each}
					</div>
				{:else if shown}
					<div class="flex flex-wrap items-start justify-between gap-3">
						<h2 class="text-base font-semibold text-zinc-100">“{shown.opponent_claim}”</h2>
						<ReviewBadge state={shown.review} />
					</div>
					<p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-200">{shown.counter_punch}</p>
					<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
						<span>{originLabel(shown.origin)}</span>
						{#if card.isFallback}<span class="text-amber-300">{languageLabel(shown.locale)}</span>{/if}
					</div>
					{#if shown.origin === 'ai_drafted' && shown.review !== 'human_approved'}
						<p class="mt-2 rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-300">{m.arg_ai_notice()}</p>
					{/if}
				{/if}

				<div class="mt-3 text-xs text-zinc-400">
					{m.arg_sources_label()}:
					{#if card.source_ids.length}{card.source_ids.map(sourceLabel).join(' · ')}{:else}{m.arg_no_sources()}{/if}
				</div>

				<div class="mt-4 grid gap-3 {bilingualView ? 'lg:grid-cols-2' : ''}">
					{#each Object.values(card.texts) as t (t.locale)}
						<details class="rounded-lg border border-zinc-800">
							<summary class="flex cursor-pointer flex-wrap items-center gap-3 px-3 py-2 text-sm">
								<span class="font-medium">{languageLabel(t.locale)}</span><ReviewBadge state={t.review} />
							</summary>
							<div class="space-y-3 border-t border-zinc-800 p-3">
								{#if t.audit_notes}<pre class="whitespace-pre-wrap rounded bg-zinc-950 p-2 text-xs text-zinc-400">{t.audit_notes}</pre>{/if}
								<div class="flex flex-wrap gap-2">
									{#each [['human_approved', m.repo_approve()], ['flagged', m.repo_flag()], ['draft', m.repo_to_draft()]] as [to, label] (to)}
										{#if t.review !== to}
											<form method="POST" action="?/review" use:enhance>
												<input type="hidden" name="argumentId" value={card.id} /><input type="hidden" name="locale" value={t.locale} /><input type="hidden" name="to" value={to} />
												<button class="rounded border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800">{label}</button>
											</form>
										{/if}
									{/each}
								</div>
								<form method="POST" action="?/saveText" use:enhance class="space-y-2">
									<input type="hidden" name="argumentId" value={card.id} /><input type="hidden" name="locale" value={t.locale} /><input type="hidden" name="source_ids_present" value="1" />
									<textarea name="opponent_claim" rows="2" required class={input}>{t.opponent_claim}</textarea>
									<textarea name="counter_punch" rows="4" required class={input}>{t.counter_punch}</textarea>
									<input name="keywords" value={t.keywords ?? ''} placeholder={m.f_keywords()} class={input} />
									<div class="grid max-h-40 gap-1 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 sm:grid-cols-2">
										{#each data.sources as s (s.id)}
											<label class="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-xs hover:bg-zinc-900">
												<input type="checkbox" name="source_ids" value={s.id} checked={card.source_ids.includes(s.id)} class="mt-0.5" />
												<span class="text-zinc-200">{s.label}</span>
											</label>
										{/each}
									</div>
									<p class="text-xs text-amber-300">{m.arg_edit_warning()}</p>
									<button class="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-950">{m.repo_save()}</button>
								</form>
							</div>
						</details>
					{/each}
				</div>

				{#if data.isAdmin}
					<form method="POST" action="?/delete" use:enhance={({ cancel }) => { if (!confirm(m.arg_delete_confirm())) cancel(); }} class="mt-4">
						<input type="hidden" name="argumentId" value={card.id} />
						<button class="text-xs text-rose-400 hover:underline">{m.repo_delete()}</button>
					</form>
				{/if}
			</article>
		{:else}
			<p class="text-sm text-zinc-500">{m.arg_none()}</p>
		{/each}
	</div>
</div>
