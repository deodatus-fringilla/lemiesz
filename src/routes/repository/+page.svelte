<script lang="ts">
	import { enhance } from '$app/forms';
	import { ExternalLink, Plus, Search } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';
	import ReviewBadge from '$lib/components/ReviewBadge.svelte';
	import { categoryLabel, languageLabel, originLabel, reviewLabel } from '$lib/i18n/labels';

	let { data, form } = $props();

	let showCreate = $state(false);
	const coverage = $derived(Object.entries(data.coverage));
	const errors = $derived((form && 'errors' in form ? (form.errors as string[]) : []) ?? []);
</script>

<div class="space-y-8">
	<div class="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-6 md:flex-row md:items-end">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{m.repo_title()}</h1>
			<p class="mt-1 text-sm text-zinc-400">{m.repo_intro()}</p>
		</div>
		<button
			type="button"
			onclick={() => (showCreate = !showCreate)}
			class="inline-flex items-center gap-2 self-start rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
		>
			<Plus class="h-4 w-4" />
			{m.repo_add()}
		</button>
	</div>

	{#if errors.length}
		<ul role="alert" class="space-y-1 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
			{#each errors as e (e)}<li>{e}</li>{/each}
		</ul>
	{/if}

	<section aria-label={m.repo_coverage()} class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		{#each coverage as [code, c] (code)}
			<div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
				<div class="flex items-baseline justify-between">
					<span class="font-semibold">{languageLabel(code)}</span>
					<span class="text-sm text-zinc-400">{c.percentage}%</span>
				</div>
				<div class="mt-2 h-1.5 rounded bg-zinc-800">
					<div class="h-1.5 rounded bg-amber-500" style="width: {c.percentage}%"></div>
				</div>
				<div class="mt-2 text-xs text-zinc-400">
					{c.translated}/{c.total} {m.repo_translated()} · {c.approved} {m.repo_approved()}
				</div>
			</div>
		{/each}
	</section>

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
			{#snippet field(name: string, label: string, required = true)}
				<label class="block text-sm">
					<span class="mb-1 block text-zinc-300">{label}</span>
					<input {name} {required} class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
				</label>
			{/snippet}
			{@render field('work', m.f_work())}
			{@render field('section_ref', m.f_section())}
			<label class="block text-sm">
				<span class="mb-1 block text-zinc-300">{m.f_category()}</span>
				<select name="category" class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
					{#each data.options.categories as c (c)}<option value={c}>{categoryLabel(c)}</option>{/each}
				</select>
			</label>
			{@render field('url', m.f_url(), false)}
			<div class="md:col-span-2">{@render field('license', m.f_license())}</div>
			<label class="block text-sm">
				<span class="mb-1 block text-zinc-300">{m.f_original_locale()}</span>
				<select name="original_locale" class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
					{#each data.options.originalLocales as l (l)}<option value={l}>{languageLabel(l)}</option>{/each}
				</select>
			</label>
			<label class="block text-sm">
				<span class="mb-1 block text-zinc-300">{m.f_locale()}</span>
				<select name="locale" class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
					{#each data.options.originalLocales as l (l)}<option value={l}>{languageLabel(l)}</option>{/each}
				</select>
			</label>
			<label class="block text-sm">
				<span class="mb-1 block text-zinc-300">{m.f_origin()}</span>
				<select name="origin" class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
					{#each data.options.origins as o (o)}<option value={o}>{originLabel(o)}</option>{/each}
				</select>
			</label>
			{@render field('translator', m.f_translator(), false)}
			<label class="block text-sm md:col-span-2">
				<span class="mb-1 block text-zinc-300">{m.f_text()}</span>
				<textarea name="text" rows="6" required class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"></textarea>
			</label>
			<div class="md:col-span-2">{@render field('keywords', m.f_keywords(), false)}</div>
			<label class="flex items-center gap-2 text-sm md:col-span-2">
				<input type="checkbox" name="cleared_to_store" />
				{m.f_cleared()}
			</label>
			<div class="flex gap-3 md:col-span-2">
				<button class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950">{m.repo_save()}</button>
				<button type="button" onclick={() => (showCreate = false)} class="rounded-lg border border-zinc-700 px-4 py-2 text-sm">
					{m.repo_cancel()}
				</button>
			</div>
		</form>
	{/if}

	<form method="GET" class="flex flex-wrap items-center gap-3">
		<div class="relative min-w-60 flex-1">
			<Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
			<input
				name="q"
				value={data.filters.q}
				placeholder={m.repo_search()}
				class="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-3 text-sm"
			/>
		</div>
		<select name="category" class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
			<option value="">{m.repo_all()}</option>
			{#each data.options.categories as c (c)}
				<option value={c} selected={data.filters.category === c}>{categoryLabel(c)}</option>
			{/each}
		</select>
		<select name="review" class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
			<option value="">{m.repo_all()}</option>
			{#each data.options.reviews as r (r)}
				<option value={r} selected={data.filters.review === r}>{reviewLabel(r)}</option>
			{/each}
		</select>
		<select name="locale" class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
			{#each data.options.uiLocales as l (l)}
				<option value={l} selected={data.filters.locale === l}>{languageLabel(l)}</option>
			{/each}
		</select>
		<button class="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">{m.repo_search_submit()}</button>
	</form>

	<div class="space-y-4">
		{#each data.sources as source (source.id)}
			{@const shown = source.activeText}
			{@const missing = data.options.uiLocales.filter((l) => !source.translations[l])}
			<article class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 class="text-lg font-semibold">{source.work} <span class="text-amber-400">{source.section_ref}</span></h2>
						<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
							<span class="rounded bg-zinc-800 px-2 py-0.5">{categoryLabel(source.category)}</span>
							<span>{m.f_original_locale()}: {languageLabel(source.original_locale)}</span>
							{#if !source.cleared_to_store}
								<span class="rounded bg-amber-500/10 px-2 py-0.5 text-amber-300">{m.repo_not_cleared()}</span>
							{/if}
							{#if source.url}
								<a href={source.url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-sky-400 hover:underline">
									<ExternalLink class="h-3 w-3" />{m.repo_open_source()}
								</a>
							{/if}
						</div>
						<div class="mt-1 text-xs text-zinc-500">{m.repo_license()}: {source.license}</div>
					</div>
					{#if shown}<ReviewBadge state={shown.review} />{/if}
				</div>

				{#if shown}
					{#if source.isFallback}
						<p class="mt-3 rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
							{m.repo_fallback({ target: languageLabel(data.filters.locale), shown: languageLabel(shown.locale) })}
						</p>
					{/if}
					<p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-200">{shown.text}</p>
					<div class="mt-2 text-xs text-zinc-500">{originLabel(shown.origin)}{shown.translator ? ` · ${shown.translator}` : ''}</div>
				{:else}
					<p class="mt-3 text-sm text-zinc-500">{m.repo_no_text()}</p>
				{/if}

				<div class="mt-4 space-y-2">
					{#each Object.values(source.translations) as t (t.locale)}
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
									<textarea name="text" rows="5" required class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">{t.text}</textarea>
									<input name="keywords" value={t.keywords ?? ''} placeholder={m.f_keywords()} class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
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
								<select name="origin" class="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
									{#each data.options.origins as o (o)}<option value={o} selected={o === 'human_translation'}>{originLabel(o)}</option>{/each}
								</select>
								<textarea name="text" rows="5" required class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"></textarea>
								<input name="keywords" placeholder={m.f_keywords()} class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
								<input name="translator" placeholder={m.f_translator()} class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
								<button class="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-950">{m.repo_save()}</button>
							</form>
						</details>
					{/each}
				</div>

				<form
					method="POST"
					action="?/delete"
					use:enhance={({ cancel }) => {
						if (!confirm(m.repo_delete_confirm({ name: `${source.work} ${source.section_ref}` }))) cancel();
					}}
					class="mt-4"
				>
					<input type="hidden" name="sourceId" value={source.id} />
					<button class="text-xs text-rose-400 hover:underline">{m.repo_delete()}</button>
				</form>
			</article>
		{:else}
			<p class="text-sm text-zinc-500">{m.repo_none()}</p>
		{/each}
	</div>
</div>
