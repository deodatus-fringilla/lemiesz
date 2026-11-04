<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages.js';
	import type { ArticleText } from '$lib/server/journal';
	import type { CitableSource } from '$lib/server/journal-citations';
	import BlockEditor from './blocks/BlockEditor.svelte';
	import type { JournalImage } from '$lib/server/journal-images';
	import type { EditorMedia } from '$lib/server/journal-media';

	/** The working copy of one language: title, lead and the blocks. Saving a change starts a new revision (draft). */
	let {
		text,
		locale,
		caliber,
		sources,
		images = [],
		media = [],
		error = null,
		dirty = $bindable(false),
		wide = $bindable(false)
	}: { text: ArticleText | null; locale: string; caliber: 'light' | 'heavy'; sources: CitableSource[]; images?: JournalImage[]; media?: EditorMedia[]; error?: string | null; dirty?: boolean; wide?: boolean } = $props();
	const input = 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none';
</script>

<form method="POST" action="?/saveText" use:enhance={() => async ({ update }) => update({ reset: false })} class="space-y-3">
	<input type="hidden" name="locale" value={locale} />
	<input name="title" lang={locale} required value={text?.title ?? ''} placeholder={m.journal_field_title()} class="{input} text-lg font-semibold" />
	<textarea name="lead" lang={locale} rows="3" placeholder={m.journal_field_lead()} class="{input} text-sm">{text?.lead ?? ''}</textarea>
	<BlockEditor initial={text?.blocks ?? []} {locale} {caliber} {sources} {images} {media} bind:dirty bind:wide />
	<p class="text-[11px] text-zinc-500">{m.journal_body_hint()}</p>
	{#if error}<p class="text-xs text-rose-300">{error}</p>{/if}
	<div class="flex flex-wrap items-center gap-3">
		<button type="submit" class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">{m.journal_save()}</button>
		{#if text}
			<span class="font-mono text-[11px] text-zinc-500">{m.journal_revision({ revision: text.revision })}{text.ai_assisted ? ` · ${m.journal_ai_assisted()}` : ''}</span>
		{/if}
	</div>
</form>
