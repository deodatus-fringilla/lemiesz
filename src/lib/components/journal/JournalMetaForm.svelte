<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages.js';
	import type { Article } from '$lib/server/journal';

	/** Calibre, author, tags and the twin in the other calibre. A calibre change restarts approval. */
	let { article, twins }: { article: Article; twins: { id: number; title: string }[] } = $props();
	const input = 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none';
</script>

<form method="POST" action="?/saveMeta" use:enhance={() => async ({ update }) => update({ reset: false })} class="space-y-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
	<h3 class="font-semibold tracking-wider text-zinc-400 uppercase">{m.journal_meta()}</h3>
	<label class="block space-y-1">
		<span class="text-zinc-400">{m.journal_caliber()}</span>
		<select name="caliber" value={article.caliber} class={input}>
			<option value="light">{m.journal_caliber_light()} · {m.journal_caliber_light_hint()}</option>
			<option value="heavy">{m.journal_caliber_heavy()} · {m.journal_caliber_heavy_hint()}</option>
		</select>
	</label>
	<label class="block space-y-1">
		<span class="text-zinc-400">{m.journal_field_author()}</span>
		<input name="author" value={article.author ?? ''} placeholder={m.journal_author_editorial()} class={input} />
	</label>
	<label class="block space-y-1">
		<span class="text-zinc-400">{m.journal_field_tags()}</span>
		<input name="tags" value={article.tags ?? ''} class={input} />
	</label>
	<label class="block space-y-1">
		<span class="text-zinc-400">{m.journal_twin()}</span>
		<select name="twin_id" value={article.twin_id ?? ''} class={input}>
			<option value="">{m.journal_twin_none()}</option>
			{#each twins as t (t.id)}<option value={t.id}>{t.title}</option>{/each}
		</select>
	</label>
	<button type="submit" class="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">{m.journal_save()}</button>
</form>
