<script lang="ts">
	import { enhance } from '$app/forms';
	import { Layers, Sparkles } from 'lucide-svelte';
	import type { PosterRecord } from '$lib/server/posters';
	import { m } from '$lib/paraglide/messages.js';
	import { mediaStatusLabel, posterThemeLabel } from '$lib/i18n/labels';

	interface PosterWithLinks extends PosterRecord {
		links: { argument_id: number; opponent_claim: string | null }[];
	}

	let {
		poster,
		satelliteCount = 0,
		argumentsList = [],
		onOpenSeries
	}: {
		poster: PosterWithLinks;
		satelliteCount?: number;
		argumentsList?: { id: number; label: string }[];
		onOpenSeries?: (seriesSlug: string) => void;
	} = $props();

	const statusStyle: Record<string, string> = {
		human_approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
		draft: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
		flagged: 'border-amber-500/30 bg-amber-500/10 text-amber-300'
	};

	function handleSeriesClick() {
		if (poster.series_slug && onOpenSeries) {
			onOpenSeries(poster.series_slug);
		}
	}
</script>

<article
	class="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70 transition-all duration-200 {poster.is_planet
		? 'ring-1 ring-amber-500/40 shadow-lg shadow-amber-950/20'
		: ''}"
>
	<!-- Image Header -->
	<div class="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900 group">
		<img
			src={poster.image_path}
			alt={poster.title}
			class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
			loading="lazy"
		/>

		<!-- Status Badge -->
		<span class="absolute right-2.5 top-2.5 rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur {statusStyle[poster.status]}">
			{mediaStatusLabel(poster.status)}
		</span>

		<!-- Planet / Series Trigger Banner Overlay -->
		{#if poster.is_planet && poster.series_slug}
			<button
				type="button"
				class="absolute inset-0 flex items-end p-3 bg-gradient-to-t from-black/80 via-black/20 to-transparent cursor-pointer text-left opacity-95 group-hover:opacity-100 transition-opacity"
				onclick={handleSeriesClick}
				aria-label={m.series_open_carousel()}
			>
				<span class="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-200 shadow-md backdrop-blur">
					<Sparkles class="h-3.5 w-3.5 text-amber-400" />
					{m.series_badge_planet({ count: String(satelliteCount) })}
				</span>
			</button>
		{:else if poster.layer && poster.layer !== 'standalone'}
			<span class="absolute left-2.5 top-2.5 rounded-full border border-zinc-700/80 bg-zinc-950/80 px-2 py-0.5 text-[11px] font-medium text-zinc-300 backdrop-blur">
				{m.series_badge_satellite({ order: String(poster.series_order), layer: poster.layer === 'allegory' ? 'Alegoria' : 'Realia' })}
			</span>
		{/if}
	</div>

	<!-- Content Details -->
	<div class="flex flex-1 flex-col justify-between space-y-3 p-4">
		<div class="space-y-1.5">
			<div class="flex flex-wrap items-center gap-2 text-xs text-amber-300">
				<span class="rounded bg-amber-500/15 px-2 py-0.5 font-medium">{posterThemeLabel(poster.theme)}</span>
				<span class="font-mono text-zinc-500 truncate max-w-[200px]">{poster.image_path}</span>
			</div>
			
			<h3 class="text-base font-bold text-zinc-100 leading-snug">{poster.title}</h3>
			
			{#if poster.caption_pl}
				<p class="text-xs leading-relaxed text-zinc-300">
					<strong class="text-zinc-400">PL:</strong> {poster.caption_pl}
				</p>
			{/if}
			{#if poster.caption_en}
				<p class="text-xs leading-relaxed text-zinc-400">
					<strong class="text-zinc-500">EN:</strong> {poster.caption_en}
				</p>
			{/if}
			{#if poster.moral_quote_pl}
				<p class="text-xs font-serif italic text-amber-200/90 border-l-2 border-amber-500/40 pl-2">
					„{poster.moral_quote_pl}”
				</p>
			{/if}
			{#if poster.symbolism_notes}
				<p class="text-xs italic text-zinc-400">{poster.symbolism_notes}</p>
			{/if}
			{#if poster.production_credits}
				<p class="text-[11px] text-zinc-500">{poster.production_credits}</p>
			{/if}
		</div>

		<!-- Series Action Button for Planet Posters -->
		{#if poster.is_planet && poster.series_slug}
			<div class="pt-1">
				<button
					type="button"
					class="w-full flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-colors shadow-sm"
					onclick={handleSeriesClick}
				>
					<Layers class="h-4 w-4" />
					{m.series_open_carousel()}
				</button>
			</div>
		{/if}

		<!-- Argument Links and Administrative Actions -->
		<div class="space-y-2 border-t border-zinc-800/80 pt-3">
			<div class="text-xs font-semibold text-zinc-400">{m.media_link_title()}:</div>
			<ul class="space-y-1 text-xs">
				{#each poster.links as l (l.argument_id)}
					<li class="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-900/50 px-2.5 py-1">
						<a href="/arguments?q={encodeURIComponent(l.opponent_claim ?? '')}" class="truncate text-zinc-300 hover:text-amber-300">
							{l.opponent_claim ?? `#${l.argument_id}`}
						</a>
						<form method="POST" action="?/unlinkPoster" use:enhance>
							<input type="hidden" name="posterId" value={poster.id} />
							<input type="hidden" name="argumentId" value={l.argument_id} />
							<button class="text-[11px] text-zinc-500 hover:text-rose-300">{m.media_unlink()}</button>
						</form>
					</li>
				{:else}
					<li class="text-xs text-zinc-500">{m.media_no_links()}</li>
				{/each}
			</ul>

			{#if argumentsList.length}
				<form method="POST" action="?/linkPoster" use:enhance class="flex gap-2 pt-1">
					<input type="hidden" name="posterId" value={poster.id} />
					<select name="argumentId" class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs">
						{#each argumentsList as a (a.id)}
							<option value={a.id}>{a.label}</option>
						{/each}
					</select>
					<button class="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs hover:bg-zinc-800">{m.media_link_add()}</button>
				</form>
			{/if}

			<div class="flex flex-wrap gap-2 pt-2 text-xs">
				{#if poster.status !== 'human_approved'}
					<form method="POST" action="?/posterStatus" use:enhance>
						<input type="hidden" name="posterId" value={poster.id} />
						<input type="hidden" name="to" value="human_approved" />
						<button class="rounded bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-500">{m.media_approve()}</button>
					</form>
				{/if}
				{#if poster.status !== 'flagged'}
					<form method="POST" action="?/posterStatus" use:enhance>
						<input type="hidden" name="posterId" value={poster.id} />
						<input type="hidden" name="to" value="flagged" />
						<button class="rounded border border-amber-500/40 px-2.5 py-1 text-amber-300 hover:bg-amber-500/10">{m.media_flag()}</button>
					</form>
				{/if}
				{#if poster.status !== 'draft'}
					<form method="POST" action="?/posterStatus" use:enhance>
						<input type="hidden" name="posterId" value={poster.id} />
						<input type="hidden" name="to" value="draft" />
						<button class="rounded border border-zinc-700 px-2.5 py-1 hover:bg-zinc-900">{m.media_to_draft()}</button>
					</form>
				{/if}
			</div>
		</div>
	</div>
</article>
