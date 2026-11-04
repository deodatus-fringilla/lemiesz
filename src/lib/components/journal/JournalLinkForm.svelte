<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages.js';
	import type { MediaRecord } from '$lib/server/media';
	import { linkTypeLabel } from './journal-ui';

	/** Add a Biblioteka link, or edit one when `link` is given. Editing what readers see resets it to draft. */
	let {
		linkTypes,
		link = null,
		error = null,
		ondone
	}: { linkTypes: readonly string[]; link?: MediaRecord | null; error?: string | null; ondone?: () => void } = $props();

	const input = 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none';
</script>

<form
	method="POST"
	action="?/saveLink"
	use:enhance={() => async ({ result, update }) => {
		await update({ reset: !link });
		if (result.type === 'success') ondone?.();
	}}
	class="space-y-3 rounded-xl border border-amber-500/25 bg-zinc-900/60 p-4"
>
	<h2 class="text-sm font-semibold text-amber-400">{link ? m.journal_link_edit_title() : m.journal_link_new_title()}</h2>
	{#if link}<input type="hidden" name="mediaId" value={link.id} />{/if}
	<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
		<input name="url" type="url" required value={link?.url ?? ''} placeholder={m.journal_link_url()} class={input} />
		<select name="media_type" required class={input} value={link?.media_type ?? 'article'}>
			{#each linkTypes as t (t)}<option value={t}>{linkTypeLabel(t)}</option>{/each}
		</select>
	</div>
	<div class="grid gap-3 sm:grid-cols-2">
		<input name="title" required value={link?.title ?? ''} placeholder={m.journal_link_title()} class={input} />
		<input name="artist_or_author" required value={link?.artist_or_author ?? ''} placeholder={m.journal_link_author()} class={input} />
	</div>
	<textarea name="public_note" required rows="2" placeholder={m.journal_link_note()} class={input}>{link?.public_note ?? ''}</textarea>
	<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
		<input name="archive_url" type="url" value={link?.archive_url ?? ''} placeholder={m.journal_link_archive()} class={input} />
		<input name="language" value={link?.language ?? ''} placeholder={m.journal_link_language()} class={input} />
	</div>
	<p class="text-[11px] text-zinc-500">{m.journal_link_embed_hint()}</p>
	{#if error}<p class="text-xs text-rose-300">{error}</p>{/if}
	<div class="flex gap-2">
		<button type="submit" class="rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">{m.journal_save()}</button>
		{#if link && ondone}
			<button type="button" onclick={ondone} class="rounded-lg border border-zinc-700 px-3.5 py-2 text-sm text-zinc-300 hover:bg-zinc-800">{m.journal_cancel()}</button>
		{/if}
	</div>
</form>
