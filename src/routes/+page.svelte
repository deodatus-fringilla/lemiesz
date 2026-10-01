<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	let { data } = $props();

	const tiles = $derived([
		{ label: m.dash_sources(), value: data.sources },
		{ label: m.dash_arguments(), value: data.arguments },
		{ label: m.dash_to_review(), value: data.toReview },
		{ label: m.dash_flagged(), value: data.flagged },
		{ label: m.dash_stale(), value: data.stale }
	]);
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">{m.dash_title()}</h1>
		<p class="mt-1 text-sm text-zinc-400">{m.dash_intro()}</p>
	</div>

	<div class="grid grid-cols-2 gap-4 md:grid-cols-5">
		{#each tiles as tile (tile.label)}
			<div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
				<div class="text-3xl font-bold text-amber-400">{tile.value}</div>
				<div class="mt-1 text-xs text-zinc-400">{tile.label}</div>
			</div>
		{/each}
	</div>

	<div class="flex flex-wrap gap-3 text-sm">
		<a href="/repository" class="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-zinc-950 hover:bg-amber-400">{m.dash_open_repo()}</a>
		<a href="/review" class="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-900">{m.dash_open_review()}</a>
	</div>
</div>
