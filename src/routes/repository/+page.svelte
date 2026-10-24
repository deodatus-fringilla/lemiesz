<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { BookOpen, Check, Columns2, Copy, ExternalLink, Library, Mail, Plus, Search, Shield } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';
	import ReviewBadge from '$lib/components/ReviewBadge.svelte';
	import { categoryLabel, languageLabel, originLabel, reviewLabel } from '$lib/i18n/labels';

	// "Spichlerz Lemiesza" — the three-panel corpus reader (docs/00_Architect_Exchange/Propozycja_Spichlerz_UI.md):
	// document type and category/thread · result list · reader and editor. The URL holds the whole state.

	let { data, form } = $props();

	let bilingualView = $state(true);
	let copied = $state<string | null>(null);
	const coverage = $derived(Object.entries(data.coverage));
	const errors = $derived((form && 'errors' in form ? (form.errors as string[]) : []) ?? []);
	const saved = $derived(!!form && ('updatedId' in form || 'deletedId' in form));
	const isAdmin = $derived(page.data.user?.role === 'admin');
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	function debouncedSubmit(formEl: HTMLFormElement | null) {
		if (!formEl) return;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => formEl.requestSubmit(), 300);
	}

	/** A reader link: the current filters with some parameters replaced ('' removes one). */
	function link(changes: Record<string, string | number>): string {
		const params = new URLSearchParams();
		const current: Record<string, string> = {
			view: data.view,
			q: data.filters.q,
			category: data.filters.category,
			review: data.filters.review,
			thread: data.filters.thread,
			lang: data.filters.lang,
			id: data.selectedId
		};
		for (const [k, v] of Object.entries({ ...current, ...changes })) if (v !== '' && v !== undefined) params.set(k, String(v));
		return `/repository?${params}`;
	}

	async function copy(key: string, text: string) {
		await navigator.clipboard.writeText(text);
		copied = key;
		setTimeout(() => (copied === key ? (copied = null) : null), 1500);
	}

	const quoteMarks = (locale: string, text: string) => (locale === 'pl' ? `„${text}”` : `"${text}"`);

	const views = [
		{ id: 'sources', label: () => m.spichlerz_view_sources(), icon: Library },
		{ id: 'canon', label: () => m.spichlerz_view_canon(), icon: BookOpen },
		{ id: 'letters', label: () => m.spichlerz_view_letters(), icon: Mail }
	] as const;

	const resultCount = $derived(data.view === 'canon' ? data.canons.length : data.view === 'letters' ? data.letters.length : data.sources.length);
	const input = 'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm';
</script>

<div class="space-y-6">
	<div class="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-5 md:flex-row md:items-end">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{m.repo_title()}</h1>
			<p class="mt-1 text-sm text-zinc-400">{m.repo_intro()}</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if data.view === 'sources'}
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
				<a href={link({ new: 'source', id: '' })} class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
					<Plus class="h-4 w-4" />{m.repo_add()}
				</a>
			{:else if data.view === 'letters'}
				<a href={link({ new: 'letter', id: '' })} class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
					<Plus class="h-4 w-4" />{m.letter_add()}
				</a>
			{/if}
		</div>
	</div>

	{#if errors.length}
		<ul role="alert" class="space-y-1 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
			{#each errors as e (e)}<li>{e}</li>{/each}
		</ul>
	{:else if saved}
		<p role="status" class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">{m.spichlerz_snapshot_hint()}</p>
	{/if}

	{#if data.view === 'sources'}
		<section aria-label={m.repo_coverage()} class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each coverage as [code, c] (code)}
				<div class="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
					<div class="flex items-baseline justify-between">
						<span class="text-sm font-semibold">{languageLabel(code)}</span>
						<span class="text-sm text-zinc-400">{c.percentage}%</span>
					</div>
					<div class="mt-2 h-1.5 rounded bg-zinc-800">
						<div class="h-1.5 rounded bg-amber-500" style="width: {c.percentage}%"></div>
					</div>
					<div class="mt-1.5 text-xs text-zinc-400">
						{c.translated}/{c.total} {m.repo_translated()} · {c.approved} {m.repo_approved()}
					</div>
				</div>
			{/each}
		</section>
	{/if}

	<div class="grid gap-5 lg:grid-cols-[12rem_19rem_minmax(0,1fr)]">
		<!-- 1. Navigation: document type, then category or thread -->
		<nav aria-label={m.spichlerz_doc_type()} class="space-y-5">
			<div>
				<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{m.spichlerz_doc_type()}</h2>
				<ul class="space-y-1">
					{#each views as v (v.id)}
						{@const Icon = v.icon}
						<li>
							<a
								href={link({ view: v.id, id: '', q: '', category: '', review: '', thread: '' })}
								aria-current={data.view === v.id ? 'page' : undefined}
								class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm {data.view === v.id
									? 'bg-amber-500/10 font-semibold text-amber-300'
									: 'text-zinc-300 hover:bg-zinc-900'}"
							>
								<Icon class="h-4 w-4" />{v.label()}
							</a>
						</li>
					{/each}
				</ul>
			</div>

			{#if data.view === 'sources'}
				<div>
					<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{m.spichlerz_categories()}</h2>
					<ul class="space-y-1 text-sm">
						<li>
							<a href={link({ category: '', id: '' })} class="block rounded px-3 py-1.5 {data.filters.category === '' ? 'text-amber-300' : 'text-zinc-400 hover:bg-zinc-900'}">
								{m.spichlerz_all()}
							</a>
						</li>
						{#each data.options.categories as c (c)}
							<li>
								<a
									href={link({ category: c, id: '' })}
									class="flex justify-between rounded px-3 py-1.5 {data.filters.category === c ? 'text-amber-300' : 'text-zinc-400 hover:bg-zinc-900'}"
								>
									<span>{categoryLabel(c)}</span><span class="text-zinc-600">{data.categoryCounts[c] ?? 0}</span>
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{:else if data.view === 'letters'}
				<div>
					<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{m.spichlerz_threads()}</h2>
					<ul class="space-y-1 text-sm">
						<li>
							<a href={link({ thread: '', id: '' })} class="block rounded px-3 py-1.5 {data.filters.thread === '' ? 'text-amber-300' : 'text-zinc-400 hover:bg-zinc-900'}">
								{m.spichlerz_all()}
							</a>
						</li>
						{#each data.threads as t (t.id)}
							<li>
								<a
									href={link({ thread: t.id, id: '' })}
									title={t.title}
									class="flex justify-between gap-2 rounded px-3 py-1.5 {data.filters.thread === String(t.id) ? 'text-amber-300' : 'text-zinc-400 hover:bg-zinc-900'}"
								>
									<span class="truncate">{t.organization}</span><span class="text-zinc-600">{t.letterCount}</span>
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</nav>

		<!-- 2. Result list -->
		<section aria-label={m.spichlerz_results({ n: resultCount })} class="min-w-0 space-y-3">
			<form method="GET" class="space-y-2">
				<input type="hidden" name="view" value={data.view} />
				<input type="hidden" name="category" value={data.filters.category} />
				<input type="hidden" name="thread" value={data.filters.thread} />
				<div class="relative">
					<Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
					<input
						name="q"
						value={data.filters.q}
						oninput={(e) => debouncedSubmit((e.currentTarget as HTMLInputElement).form)}
						placeholder={data.view === 'canon' ? m.spichlerz_canon_search() : data.view === 'letters' ? m.spichlerz_letter_search() : m.repo_search()}
						class="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-3 text-sm"
					/>
				</div>
				<div class="flex gap-2">
					{#if data.view === 'sources'}
						<select
							name="review"
							aria-label={m.nav_review()}
							onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}
							class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
						>
							<option value="">{m.repo_all()}</option>
							{#each data.options.reviews as r (r)}
								<option value={r} selected={data.filters.review === r}>{reviewLabel(r)}</option>
							{/each}
						</select>
					{/if}
					<select
						name="lang"
						aria-label={m.f_locale()}
						onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.requestSubmit()}
						class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
					>
						{#each data.options.uiLocales as l (l)}
							<option value={l} selected={data.filters.lang === l}>{languageLabel(l)}</option>
						{/each}
					</select>
					<button class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-900">{m.repo_search_submit()}</button>
				</div>
			</form>

			<ul class="max-h-[70vh] space-y-1.5 overflow-y-auto pr-1">
				{#if data.view === 'sources'}
					{#each data.sources as s (s.id)}
						<li>
							<a
								href={link({ id: s.id, new: '' })}
								aria-current={data.selectedId === String(s.id) ? 'true' : undefined}
								class="block rounded-lg border px-3 py-2 text-sm {data.selectedId === String(s.id)
									? 'border-amber-500/50 bg-amber-500/5'
									: 'border-zinc-800 hover:bg-zinc-900'}"
							>
								<div class="font-medium text-zinc-200">{s.work}</div>
								<div class="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
									<span class="text-amber-400">{s.section_ref}</span>
									{#if s.activeText}<ReviewBadge state={s.activeText.review} />{/if}
								</div>
							</a>
						</li>
					{:else}
						<li class="text-sm text-zinc-500">{m.repo_none()}</li>
					{/each}
				{:else if data.view === 'canon'}
					{#each data.canons as c (c.slug)}
						<li>
							<a
								href={link({ id: c.slug })}
								class="block rounded-lg border px-3 py-2 text-sm {data.selectedId === c.slug ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-800 hover:bg-zinc-900'}"
							>
								<span class="font-mono text-xs text-amber-400">{c.number}</span>
								<span class="text-zinc-200">{c.title.replace(/^Canon \d+\s*·\s*/, '')}</span>
							</a>
						</li>
					{/each}
				{:else}
					{#each data.letters as l (l.id)}
						<li>
							<a
								href={link({ id: l.id, new: '' })}
								class="block rounded-lg border px-3 py-2 text-sm {data.selectedId === String(l.id) ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-800 hover:bg-zinc-900'}"
							>
								<div class="flex items-center justify-between gap-2 text-xs">
									<span class="font-semibold text-amber-400">{m.letter_turn()} {l.turn_number}</span>
									<span class={l.direction === 'outbound' ? 'text-sky-400' : 'text-rose-300'}>
										{l.direction === 'outbound' ? m.letter_outbound() : m.letter_inbound()}
									</span>
								</div>
								<div class="mt-0.5 line-clamp-2 text-zinc-300">{data.filters.lang === 'en' ? l.summary_en : l.summary_pl}</div>
								<div class="mt-0.5 text-xs text-zinc-500">{l.date_label}</div>
							</a>
						</li>
					{:else}
						<li class="text-sm text-zinc-500">{m.letter_none()}</li>
					{/each}
				{/if}
			</ul>
		</section>

		<!-- 3. Reader and editor -->
		<section class="min-w-0">
			{#if data.creating === 'source'}
				{@render sourceForm()}
			{:else if data.creating === 'letter'}
				{@render letterForm(null)}
			{:else if data.source}
				{@render sourceReader(data.source)}
			{:else if data.letter}
				{@render letterReader(data.letter)}
			{:else if data.canon}
				<article class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
					<p class="mb-4 rounded bg-zinc-800/60 px-3 py-2 text-xs text-zinc-400">{m.spichlerz_canon_readonly({ file: data.canon.file })}</p>
					<!-- Repository-owned Markdown (corpus/canon), never user input: see $lib/server/canon.ts -->
					<div class="canon">{@html data.canon.html}</div>
				</article>
			{:else}
				<p class="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">{m.spichlerz_pick()}</p>
			{/if}
		</section>
	</div>
</div>

{#snippet sourceReader(source: NonNullable<typeof data.source>)}
	{@const texts = Object.values(source.translations)}
	{@const shown = source.activeText}
	{@const missing = data.options.uiLocales.filter((l) => !source.translations[l])}
	<article class="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
		<header>
			<h2 class="text-xl font-semibold">{source.work} <span class="text-amber-400">{source.section_ref}</span></h2>
			<dl aria-label={m.spichlerz_metadata()} class="mt-2 grid gap-x-4 gap-y-1 text-xs text-zinc-400 sm:grid-cols-[auto_1fr]">
				<dt class="text-zinc-500">{m.f_category()}</dt><dd>{categoryLabel(source.category)}</dd>
				<dt class="text-zinc-500">{m.f_original_locale()}</dt><dd>{languageLabel(source.original_locale)}</dd>
				<dt class="text-zinc-500">{m.repo_license()}</dt><dd class="text-zinc-300">{source.license}</dd>
				{#if !source.cleared_to_store}
					<dt></dt><dd><span class="rounded bg-amber-500/10 px-2 py-0.5 text-amber-300">{m.repo_not_cleared()}</span></dd>
				{/if}
				{#if source.url}
					<dt></dt>
					<dd>
						<a href={source.url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-sky-400 hover:underline">
							<ExternalLink class="h-3 w-3" />{m.repo_open_source()}
						</a>
					</dd>
				{/if}
			</dl>
			<div class="mt-3 flex flex-wrap gap-2">
				{#if shown}
					<button
						type="button"
						onclick={() => copy(`src-${source.id}`, `${quoteMarks(shown.locale, shown.text)} [[src:${source.id}]]`)}
						class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
					>
						{#if copied === `src-${source.id}`}<Check class="h-3.5 w-3.5 text-emerald-400" />{m.spichlerz_copied()}{:else}<Copy class="h-3.5 w-3.5" />{m.spichlerz_copy_quote()}{/if}
					</button>
				{/if}
				<a href="/shield?source={source.id}" class="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10">
					<Shield class="h-3.5 w-3.5" />{m.spichlerz_to_shield()}
				</a>
			</div>
		</header>

		{#if bilingualView && texts.length > 1}
			<div class="grid gap-4 xl:grid-cols-2">
				{#each texts as t (t.locale)}{@render textCard(t)}{/each}
			</div>
		{:else if shown}
			{#if source.isFallback}
				<p class="rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
					{m.repo_fallback({ target: languageLabel(data.filters.lang), shown: languageLabel(shown.locale) })}
				</p>
			{/if}
			{@render textCard(shown)}
		{:else}
			<p class="text-sm text-zinc-500">{m.repo_no_text()}</p>
		{/if}

		<div class="space-y-3">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-zinc-500">{m.spichlerz_texts()}</h3>
			{#each texts as t (t.locale)}
				<details class="rounded-lg border border-zinc-800">
					<summary class="flex cursor-pointer flex-wrap items-center gap-3 px-3 py-2 text-sm">
						<span class="font-medium">{languageLabel(t.locale)}</span>
						<ReviewBadge state={t.review} />
						<span class="text-xs text-zinc-500">{originLabel(t.origin)}</span>
					</summary>
					<div class="space-y-3 border-t border-zinc-800 p-3">
						<div class="flex flex-wrap gap-2">
							{#each [['human_approved', m.repo_approve()], ['flagged', m.repo_flag()], ['draft', m.repo_to_draft()]] as [to, label] (to)}
								{#if t.review !== to}
									<form method="POST" action="?/review" use:enhance>
										<input type="hidden" name="sourceId" value={source.id} />
										<input type="hidden" name="locale" value={t.locale} />
										<input type="hidden" name="to" value={to} />
										<button class="rounded border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800">{label}</button>
									</form>
								{/if}
							{/each}
						</div>
						<form method="POST" action="?/saveText" use:enhance class="space-y-2">
							<input type="hidden" name="sourceId" value={source.id} />
							<input type="hidden" name="locale" value={t.locale} />
							<input type="hidden" name="origin" value={t.origin} />
							<textarea name="text" rows="6" required aria-label={m.f_text()} class={input}>{t.text}</textarea>
							<input name="keywords" value={t.keywords ?? ''} placeholder={m.f_keywords()} aria-label={m.f_keywords()} class={input} />
							<input name="translator" value={t.translator ?? ''} placeholder={m.f_translator()} aria-label={m.f_translator()} class={input} />
							<p class="text-xs text-amber-300">{m.repo_edit_warning()}</p>
							<button class="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-950">{m.repo_save()}</button>
						</form>
					</div>
				</details>
			{/each}
			{#each missing as l (l)}
				<details class="rounded-lg border border-dashed border-zinc-700">
					<summary class="cursor-pointer px-3 py-2 text-sm text-zinc-400">{m.repo_add_translation()}: {languageLabel(l)}</summary>
					<form method="POST" action="?/saveText" use:enhance class="space-y-2 border-t border-zinc-800 p-3">
						<input type="hidden" name="sourceId" value={source.id} />
						<input type="hidden" name="locale" value={l} />
						<select name="origin" aria-label={m.f_origin()} class="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
							{#each data.options.origins as o (o)}<option value={o} selected={o === 'human_translation'}>{originLabel(o)}</option>{/each}
						</select>
						<textarea name="text" rows="5" required aria-label={m.f_text()} class={input}></textarea>
						<input name="keywords" placeholder={m.f_keywords()} aria-label={m.f_keywords()} class={input} />
						<input name="translator" placeholder={m.f_translator()} aria-label={m.f_translator()} class={input} />
						<button class="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-950">{m.repo_save()}</button>
					</form>
				</details>
			{/each}
		</div>

		{#if isAdmin}
			<form
				method="POST"
				action="?/delete"
				use:enhance={({ cancel }) => {
					if (!confirm(m.repo_delete_confirm({ name: `${source.work} ${source.section_ref}` }))) cancel();
				}}
			>
				<input type="hidden" name="sourceId" value={source.id} />
				<button class="text-xs text-rose-400 hover:underline">{m.repo_delete()}</button>
			</form>
		{/if}
	</article>
{/snippet}

{#snippet textCard(t: NonNullable<NonNullable<typeof data.source>['activeText']>)}
	<div class="rounded-lg border border-zinc-800/90 bg-zinc-950/50 p-3.5">
		<div class="mb-2 flex items-center justify-between gap-2">
			<span class="rounded bg-zinc-800 px-2 py-0.5 text-xs font-semibold uppercase text-amber-300">{t.locale} · {languageLabel(t.locale)}</span>
			<ReviewBadge state={t.review} />
		</div>
		<p class="whitespace-pre-line text-sm leading-relaxed text-zinc-200">{t.text}</p>
		<div class="mt-2 text-xs text-zinc-500">{originLabel(t.origin)}{t.translator ? ` · ${t.translator}` : ''}</div>
	</div>
{/snippet}

{#snippet letterReader(letter: NonNullable<typeof data.letter>)}
	<article class="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
		<header>
			<div class="text-xs text-zinc-500">{letter.thread_title}</div>
			<h2 class="mt-1 text-xl font-semibold">
				{m.letter_turn()} {letter.turn_number} ·
				<span class={letter.direction === 'outbound' ? 'text-sky-400' : 'text-rose-300'}>
					{letter.direction === 'outbound' ? m.letter_outbound() : m.letter_inbound()}
				</span>
			</h2>
			<p class="mt-1 text-sm text-zinc-400">{letter.sender} → {letter.recipient} · {letter.date_label} · <span class="font-mono text-xs">{letter.filename}</span></p>
			<div class="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					onclick={() => copy(`letter-${letter.id}`, letter.body)}
					class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
				>
					{#if copied === `letter-${letter.id}`}<Check class="h-3.5 w-3.5 text-emerald-400" />{m.spichlerz_copied()}{:else}<Copy class="h-3.5 w-3.5" />{m.spichlerz_copy_letter()}{/if}
				</button>
				<a
					href="/shield?tab=deconstruct&letter={letter.id}"
					class="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10"
				>
					<Shield class="h-3.5 w-3.5" />{m.spichlerz_to_shield()}
				</a>
			</div>
		</header>
		<p class="rounded-lg bg-zinc-950/60 p-3 text-sm italic text-zinc-300">{data.filters.lang === 'en' ? letter.summary_en : letter.summary_pl}</p>
		<div class="whitespace-pre-line text-sm leading-relaxed text-zinc-200">{letter.body}</div>
		{#if letter.key_claims.length}
			<div>
				<h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{m.letter_key_claims()}</h3>
				<ol class="list-decimal space-y-1 pl-5 text-xs text-zinc-400">
					{#each letter.key_claims as c, i (i)}<li>{c}</li>{/each}
				</ol>
			</div>
		{/if}
		<details class="rounded-lg border border-zinc-800">
			<summary class="cursor-pointer px-3 py-2 text-sm">{m.letter_edit()}</summary>
			<div class="border-t border-zinc-800 p-3">{@render letterForm(letter)}</div>
		</details>
		{#if isAdmin}
			<form
				method="POST"
				action="?/deleteLetter"
				use:enhance={({ cancel }) => {
					if (!confirm(m.letter_delete_confirm({ name: letter.filename }))) cancel();
				}}
			>
				<input type="hidden" name="letterId" value={letter.id} />
				<button class="text-xs text-rose-400 hover:underline">{m.repo_delete()}</button>
			</form>
		{/if}
	</article>
{/snippet}

{#snippet letterForm(letter: typeof data.letter)}
	{#if !data.threads.length}
		<p class="text-sm text-zinc-500">{m.letter_no_thread()}</p>
	{:else}
		<form method="POST" action={letter ? '?/updateLetter' : '?/createLetter'} use:enhance class="grid gap-3 md:grid-cols-2 {letter ? '' : 'rounded-xl border border-zinc-800 bg-zinc-900/50 p-5'}">
			{#if letter}<input type="hidden" name="letterId" value={letter.id} />{:else}<h2 class="text-lg font-semibold md:col-span-2">{m.letter_add()}</h2>{/if}
			<label class="block text-sm">
				<span class="mb-1 block text-zinc-300">{m.letter_thread()}</span>
				<select name="thread_id" class={input}>
					{#each data.threads as t (t.id)}
						<option value={t.id} selected={letter ? letter.thread_id === t.id : data.filters.thread === String(t.id)}>{t.organization}</option>
					{/each}
				</select>
			</label>
			<div class="grid grid-cols-2 gap-3">
				<label class="block text-sm">
					<span class="mb-1 block text-zinc-300">{m.letter_turn()}</span>
					<input name="turn_number" type="number" min="1" required value={letter?.turn_number ?? data.nextTurn} class={input} />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block text-zinc-300">{m.letter_direction()}</span>
					<select name="direction" class={input}>
						<option value="outbound" selected={letter?.direction === 'outbound'}>{m.letter_outbound()}</option>
						<option value="inbound" selected={letter?.direction === 'inbound'}>{m.letter_inbound()}</option>
					</select>
				</label>
			</div>
			<label class="block text-sm"><span class="mb-1 block text-zinc-300">{m.letter_sender()}</span><input name="sender" required value={letter?.sender ?? ''} class={input} /></label>
			<label class="block text-sm"><span class="mb-1 block text-zinc-300">{m.letter_recipient()}</span><input name="recipient" required value={letter?.recipient ?? ''} class={input} /></label>
			<label class="block text-sm"><span class="mb-1 block text-zinc-300">{m.letter_date()}</span><input name="date_label" required value={letter?.date_label ?? ''} class={input} /></label>
			<label class="block text-sm"><span class="mb-1 block text-zinc-300">{m.letter_filename()}</span><input name="filename" required pattern="[\w.\-]+" value={letter?.filename ?? ''} class={input} /></label>
			<label class="block text-sm md:col-span-2"><span class="mb-1 block text-zinc-300">{m.letter_summary_pl()}</span><textarea name="summary_pl" rows="2" required class={input}>{letter?.summary_pl ?? ''}</textarea></label>
			<label class="block text-sm md:col-span-2"><span class="mb-1 block text-zinc-300">{m.letter_summary_en()}</span><textarea name="summary_en" rows="2" required class={input}>{letter?.summary_en ?? ''}</textarea></label>
			<label class="block text-sm md:col-span-2"><span class="mb-1 block text-zinc-300">{m.letter_body()}</span><textarea name="body" rows="14" required class={input}>{letter?.body ?? ''}</textarea></label>
			<div class="flex gap-3 md:col-span-2">
				<button class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950">{m.repo_save()}</button>
				{#if !letter}<a href={link({ new: '' })} class="rounded-lg border border-zinc-700 px-4 py-2 text-sm">{m.repo_cancel()}</a>{/if}
			</div>
		</form>
	{/if}
{/snippet}

{#snippet sourceForm()}
	<form method="POST" action="?/create" use:enhance class="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 md:grid-cols-2">
		<h2 class="text-lg font-semibold md:col-span-2">{m.repo_add()}</h2>
		{#snippet field(name: string, label: string, required = true)}
			<label class="block text-sm">
				<span class="mb-1 block text-zinc-300">{label}</span>
				<input {name} {required} class={input} />
			</label>
		{/snippet}
		{@render field('work', m.f_work())}
		{@render field('section_ref', m.f_section())}
		<label class="block text-sm">
			<span class="mb-1 block text-zinc-300">{m.f_category()}</span>
			<select name="category" class={input}>
				{#each data.options.categories as c (c)}<option value={c}>{categoryLabel(c)}</option>{/each}
			</select>
		</label>
		{@render field('url', m.f_url(), false)}
		<div class="md:col-span-2">{@render field('license', m.f_license())}</div>
		<label class="block text-sm">
			<span class="mb-1 block text-zinc-300">{m.f_original_locale()}</span>
			<select name="original_locale" class={input}>
				{#each data.options.originalLocales as l (l)}<option value={l}>{languageLabel(l)}</option>{/each}
			</select>
		</label>
		<label class="block text-sm">
			<span class="mb-1 block text-zinc-300">{m.f_locale()}</span>
			<select name="locale" class={input}>
				{#each data.options.originalLocales as l (l)}<option value={l}>{languageLabel(l)}</option>{/each}
			</select>
		</label>
		<label class="block text-sm">
			<span class="mb-1 block text-zinc-300">{m.f_origin()}</span>
			<select name="origin" class={input}>
				{#each data.options.origins as o (o)}<option value={o}>{originLabel(o)}</option>{/each}
			</select>
		</label>
		{@render field('translator', m.f_translator(), false)}
		<label class="block text-sm md:col-span-2">
			<span class="mb-1 block text-zinc-300">{m.f_text()}</span>
			<textarea name="text" rows="6" required class={input}></textarea>
		</label>
		<div class="md:col-span-2">{@render field('keywords', m.f_keywords(), false)}</div>
		<label class="flex items-center gap-2 text-sm md:col-span-2">
			<input type="checkbox" name="cleared_to_store" />
			{m.f_cleared()}
		</label>
		<div class="flex gap-3 md:col-span-2">
			<button class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950">{m.repo_save()}</button>
			<a href={link({ new: '' })} class="rounded-lg border border-zinc-700 px-4 py-2 text-sm">{m.repo_cancel()}</a>
		</div>
	</form>
{/snippet}

<style>
	.canon {
		color: var(--color-zinc-300);
		font-size: 0.9rem;
		line-height: 1.7;
	}
	.canon :global(h1) {
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--color-zinc-100);
		margin: 0 0 1rem;
	}
	.canon :global(h2) {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-amber-300);
		margin: 2rem 0 0.75rem;
	}
	.canon :global(h3) {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--color-zinc-100);
		margin: 1.5rem 0 0.5rem;
	}
	.canon :global(p),
	.canon :global(ul),
	.canon :global(ol),
	.canon :global(blockquote),
	.canon :global(table) {
		margin: 0 0 0.9rem;
	}
	.canon :global(ul) {
		list-style: disc;
		padding-left: 1.4rem;
	}
	.canon :global(ol) {
		list-style: decimal;
		padding-left: 1.4rem;
	}
	.canon :global(blockquote) {
		border-left: 3px solid var(--color-amber-500);
		padding-left: 0.9rem;
		color: var(--color-zinc-400);
	}
	.canon :global(strong) {
		color: var(--color-zinc-100);
	}
	.canon :global(a) {
		color: var(--color-sky-400);
	}
	.canon :global(code) {
		font-size: 0.8rem;
		background: var(--color-zinc-800);
		padding: 0.05rem 0.3rem;
		border-radius: 0.25rem;
	}
	.canon :global(hr) {
		border-color: var(--color-zinc-800);
		margin: 1.5rem 0;
	}
	.canon :global(table) {
		display: block;
		overflow-x: auto;
		border-collapse: collapse;
		font-size: 0.8rem;
	}
	.canon :global(th),
	.canon :global(td) {
		border: 1px solid var(--color-zinc-800);
		padding: 0.35rem 0.6rem;
		vertical-align: top;
	}
	.canon :global(th) {
		color: var(--color-zinc-100);
		background: var(--color-zinc-900);
	}
</style>
