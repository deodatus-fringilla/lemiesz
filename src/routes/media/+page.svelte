<script lang="ts">
	import { enhance } from '$app/forms';
	import { ExternalLink, Music2, Search, TriangleAlert } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { genreLabel, mediaStatusLabel, mediaTypeLabel } from '$lib/i18n/labels';

	let { data, form } = $props();

	const field = 'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm';
	const statusStyle: Record<string, string> = {
		human_approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
		draft: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
		flagged: 'border-amber-500/30 bg-amber-500/10 text-amber-300'
	};

	const href = (over: Record<string, string>) => {
		const p = new URLSearchParams();
		const merged = { genre: data.filters.genre, q: data.filters.q, m: data.selected ? String(data.selected.id) : '', ...over };
		for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
		const s = p.toString();
		return s ? `/media?${s}` : '/media';
	};
	const errors = $derived((form?.errors as string[] | undefined) ?? []);
</script>

<div class="space-y-5">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">{m.media_title()}</h1>
		<p class="mt-1 text-sm text-zinc-400">{m.media_intro()}</p>
	</div>

	<nav class="flex flex-wrap gap-2 text-sm" aria-label={m.media_f_genre()}>
		<a href={href({ genre: '', m: '' })} class="rounded-full border px-3 py-1 {data.filters.genre === '' ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-zinc-800 text-zinc-400 hover:text-zinc-100'}">{m.media_filter_all()}</a>
		{#each data.genres as g (g)}
			<a href={href({ genre: g, m: '' })} class="rounded-full border px-3 py-1 {data.filters.genre === g ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-zinc-800 text-zinc-400 hover:text-zinc-100'}">{genreLabel(g)}</a>
		{/each}
	</nav>

	<form method="GET" class="flex gap-2">
		{#if data.filters.genre}<input type="hidden" name="genre" value={data.filters.genre} />{/if}
		<input name="q" value={data.filters.q} placeholder={m.media_search()} class={field} />
		<button class="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 text-sm hover:bg-zinc-900"><Search class="h-4 w-4" />{m.media_search_btn()}</button>
	</form>

	{#if errors.length}
		<div class="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">
			{#each errors as e}<p>{e === 'forbidden' ? m.media_error_forbidden() : e}</p>{/each}
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
		<section class="space-y-2">
			{#each data.items as item (item.id)}
				<a href={href({ m: String(item.id) })} class="block rounded-xl border p-3 transition-colors {data.selected?.id === item.id ? 'border-amber-500/40 bg-zinc-900' : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900'}">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="truncate font-medium">{item.title}</p>
							<p class="truncate text-xs text-zinc-400">{item.artist_or_author} · {mediaTypeLabel(item.media_type)} · {genreLabel(item.genre)}</p>
						</div>
						<span class="shrink-0 rounded-full border px-2 py-0.5 text-[11px] {statusStyle[item.status]}">{mediaStatusLabel(item.status)}</span>
					</div>
					{#if item.ai_assisted}<p class="mt-1 text-[11px] text-sky-300">{m.media_ai_assisted()}</p>{/if}
				</a>
			{:else}
				<p class="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">{m.media_empty()}</p>
			{/each}

			<details class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4" open={form?.action === 'create' && errors.length > 0}>
				<summary class="cursor-pointer text-sm font-semibold">{m.media_add_title()}</summary>
				<form method="POST" action="?/create" use:enhance class="mt-3 space-y-3">
					{@render mediaFields(null)}
					<button class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">{m.media_save()}</button>
				</form>
			</details>
		</section>

		<section>
			{#if data.selected}
				{@const s = data.selected}
				<div class="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div>
							<h2 class="text-xl font-semibold">{s.title}</h2>
							<p class="text-sm text-zinc-400">{s.artist_or_author}</p>
						</div>
						<span class="rounded-full border px-2 py-0.5 text-xs {statusStyle[s.status]}">{mediaStatusLabel(s.status)}</span>
					</div>
					{#if s.status === 'human_approved' && s.reviewed_by}<p class="text-xs text-emerald-300">{m.media_reviewed_by({ user: s.reviewed_by })}</p>{/if}

					<!-- Only the allow-listed privacy-respecting hosts ever reach here (media.ts derives embed_url; the CSP frame-src matches). -->
					<div class="aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-black">
						<iframe
							src={s.embed_url}
							title={s.title}
							class="h-full w-full"
							loading="lazy"
							referrerpolicy="strict-origin-when-cross-origin"
							allow="encrypted-media; picture-in-picture; fullscreen"
							allowfullscreen
						></iframe>
					</div>
					<p class="flex items-center gap-2 text-xs text-zinc-400">
						<a href={s.url} target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 text-amber-400 hover:underline"><ExternalLink class="h-3.5 w-3.5" />{m.media_open_external()}</a>
						<span>· {m.media_embed_note()}</span>
					</p>

					{#if s.ai_assisted || s.production_credits}
						<div class="rounded-lg border border-zinc-800 p-3 text-sm">
							<p class="text-xs font-semibold uppercase tracking-wide text-zinc-400">{m.media_credits()}</p>
							<p class="mt-1">{s.production_credits}</p>
						</div>
					{/if}

					<div class="rounded-lg border border-zinc-800 p-3 text-sm">
						<p class="text-xs font-semibold uppercase tracking-wide text-zinc-400">{m.media_lyrics()}</p>
						{#if s.lyrics_or_transcript}
							<p class="mt-1 whitespace-pre-line">{s.lyrics_or_transcript}</p>
							<p class="mt-2 text-xs text-zinc-500">{m.media_lyrics_license()}: {s.lyrics_license}</p>
						{:else}
							<p class="mt-1 flex items-center gap-1.5 text-zinc-500"><TriangleAlert class="h-3.5 w-3.5" />{m.media_lyrics_none()}</p>
						{/if}
					</div>

					<div class="flex flex-wrap gap-2 text-sm">
						{#if s.status !== 'human_approved'}
							<form method="POST" action="?/status" use:enhance><input type="hidden" name="mediaId" value={s.id} /><input type="hidden" name="to" value="human_approved" /><button class="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500">{m.media_approve()}</button></form>
						{/if}
						{#if s.status !== 'flagged'}
							<form method="POST" action="?/status" use:enhance><input type="hidden" name="mediaId" value={s.id} /><input type="hidden" name="to" value="flagged" /><button class="rounded-lg border border-amber-500/40 px-3 py-1.5 text-amber-300 hover:bg-amber-500/10">{m.media_flag()}</button></form>
						{/if}
						{#if s.status !== 'draft'}
							<form method="POST" action="?/status" use:enhance><input type="hidden" name="mediaId" value={s.id} /><input type="hidden" name="to" value="draft" /><button class="rounded-lg border border-zinc-700 px-3 py-1.5 hover:bg-zinc-900">{m.media_to_draft()}</button></form>
						{/if}
						{#if data.isAdmin || s.created_by === data.username}
							<form method="POST" action="?/delete" use:enhance><input type="hidden" name="mediaId" value={s.id} /><button class="rounded-lg border border-rose-500/40 px-3 py-1.5 text-rose-300 hover:bg-rose-500/10">{m.media_delete()}</button></form>
						{/if}
					</div>

					<div>
						<h3 class="text-sm font-semibold">{m.media_link_title()}</h3>
						<ul class="mt-2 space-y-1 text-sm">
							{#each data.links as l (l.argument_id)}
								<li class="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-1.5">
									<span class="min-w-0 truncate"><a href="/arguments?q={encodeURIComponent(l.opponent_claim ?? '')}" class="hover:underline">{l.opponent_claim ?? `#${l.argument_id}`}</a>{#if l.cue} <span class="text-xs text-zinc-400">· {m.media_cue_label()} {l.cue}</span>{/if}</span>
									<form method="POST" action="?/unlink" use:enhance><input type="hidden" name="mediaId" value={s.id} /><input type="hidden" name="argumentId" value={l.argument_id} /><button class="text-xs text-zinc-400 hover:text-rose-300">{m.media_unlink()}</button></form>
								</li>
							{:else}
								<li class="text-zinc-500">{m.media_no_links()}</li>
							{/each}
						</ul>
						<form method="POST" action="?/link" use:enhance class="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
							<input type="hidden" name="mediaId" value={s.id} />
							<select name="argumentId" class={field} aria-label={m.media_f_argument()}>
								{#each data.arguments as a (a.id)}<option value={a.id}>{a.label}</option>{/each}
							</select>
							<input name="cue" placeholder={m.media_f_cue()} class={field} aria-label={m.media_f_cue()} />
							<button class="rounded-lg border border-zinc-700 px-3 text-sm hover:bg-zinc-900">{m.media_link_add()}</button>
						</form>
					</div>

					<details class="rounded-lg border border-zinc-800 p-3" open={form?.action === 'update' && errors.length > 0}>
						<summary class="cursor-pointer text-sm font-semibold">{m.media_edit_title()}</summary>
						<p class="mt-1 text-xs text-zinc-500">{m.media_edit_note()}</p>
						<form method="POST" action="?/update" use:enhance class="mt-3 space-y-3">
							<input type="hidden" name="mediaId" value={s.id} />
							{@render mediaFields(s)}
							<button class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">{m.media_save()}</button>
						</form>
					</details>
				</div>
			{:else}
				<div class="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
					<Music2 class="h-8 w-8" />
					<p>{m.media_select_prompt()}</p>
				</div>
			{/if}
		</section>
	</div>
</div>

{#snippet mediaFields(s: (typeof data)['selected'])}
	<div class="grid gap-3 sm:grid-cols-2">
		<label class="space-y-1 text-xs text-zinc-400">{m.media_f_title()}<input name="title" required value={s?.title ?? ''} class={field} /></label>
		<label class="space-y-1 text-xs text-zinc-400">{m.media_f_artist()}<input name="artist_or_author" required value={s?.artist_or_author ?? ''} class={field} /></label>
		<label class="space-y-1 text-xs text-zinc-400 sm:col-span-2">{m.media_f_url()}<input name="url" required value={s?.url ?? ''} class={field} /></label>
		<label class="space-y-1 text-xs text-zinc-400">{m.media_f_type()}
			<select name="media_type" class={field}>{#each data.types as t (t)}<option value={t} selected={s?.media_type === t}>{mediaTypeLabel(t)}</option>{/each}</select>
		</label>
		<label class="space-y-1 text-xs text-zinc-400">{m.media_f_genre()}
			<select name="genre" class={field}>{#each data.genres as g (g)}<option value={g} selected={s?.genre === g}>{genreLabel(g)}</option>{/each}</select>
		</label>
		<label class="space-y-1 text-xs text-zinc-400">{m.media_f_mood()}<input name="mood" value={s?.mood ?? ''} class={field} /></label>
		<label class="space-y-1 text-xs text-zinc-400">{m.media_f_audience()}<input name="target_audience" value={s?.target_audience ?? ''} class={field} /></label>
		<label class="space-y-1 text-xs text-zinc-400">{m.media_f_language()}<input name="language" value={s?.language ?? ''} class={field} /></label>
		<label class="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" name="ai_assisted" checked={s?.ai_assisted ?? false} />{m.media_f_ai()}</label>
		<label class="space-y-1 text-xs text-zinc-400 sm:col-span-2">{m.media_f_credits()}<input name="production_credits" value={s?.production_credits ?? ''} class={field} /></label>
		<label class="space-y-1 text-xs text-zinc-400 sm:col-span-2">{m.media_f_lyrics()}<textarea name="lyrics_or_transcript" rows="4" class={field}>{s?.lyrics_or_transcript ?? ''}</textarea></label>
		<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="lyrics_cleared_to_store" checked={s?.lyrics_cleared_to_store ?? false} />{m.media_f_lyrics_cleared()}</label>
		<label class="space-y-1 text-xs text-zinc-400">{m.media_f_lyrics_license()}<input name="lyrics_license" value={s?.lyrics_license ?? ''} class={field} /></label>
		<label class="space-y-1 text-xs text-zinc-400 sm:col-span-2">{m.media_f_notes()}<textarea name="notes" rows="2" class={field}>{s?.notes ?? ''}</textarea></label>
	</div>
{/snippet}
