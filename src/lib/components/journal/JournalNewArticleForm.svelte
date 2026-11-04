<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from 'lucide-svelte/icons/plus';
	import { m } from '$lib/paraglide/messages.js';

	let { error = null }: { error?: string | null } = $props();
	let caliber = $state<'light' | 'heavy'>('light');
	const input = 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none';
</script>

<form method="POST" action="?/createArticle" use:enhance class="space-y-3 rounded-xl border border-amber-500/25 bg-zinc-900/60 p-4">
	<h2 class="text-sm font-semibold text-amber-400">{m.journal_new_title()}</h2>
	<fieldset class="flex flex-wrap gap-2 text-xs">
		<legend class="sr-only">{m.journal_caliber()}</legend>
		{#each [{ v: 'light', label: m.journal_caliber_light(), hint: m.journal_caliber_light_hint() }, { v: 'heavy', label: m.journal_caliber_heavy(), hint: m.journal_caliber_heavy_hint() }] as c (c.v)}
			<label class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 {caliber === c.v ? 'border-amber-500/50 bg-amber-500/10 text-amber-200' : 'border-zinc-800 text-zinc-300'}">
				<input type="radio" name="caliber" value={c.v} bind:group={caliber} class="accent-amber-500" />
				<span><strong>{c.label}</strong> · {c.hint}</span>
			</label>
		{/each}
	</fieldset>
	<input name="title" required placeholder={m.journal_field_title()} class={input} />
	<input name="lead" placeholder={m.journal_field_lead()} class={input} />
	<p class="text-[11px] text-zinc-500">{m.journal_new_hint()}</p>
	<div class="grid gap-3 sm:grid-cols-2">
		<input name="author" placeholder={m.journal_field_author()} class={input} />
		<input name="tags" placeholder={m.journal_field_tags()} class={input} />
	</div>
	<input type="hidden" name="locale" value="pl" />
	{#if error}<p class="text-xs text-rose-300">{error}</p>{/if}
	<button type="submit" class="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
		<Plus class="h-4 w-4" />{m.journal_new_submit()}
	</button>
</form>
