<script lang="ts">
	import { deserialize } from '$app/forms';
	import { m } from '$lib/paraglide/messages.js';
	import type { Footnote, RenderedBlock } from '$lib/server/journal-render';
	import PublicArticleBody from '../public/PublicArticleBody.svelte';
	import PublicFootnotes from '../public/PublicFootnotes.svelte';

	/** Unsaved blocks rendered by the server with the readers' renderer, refreshed shortly after each change. */
	let { json, locale, caliber }: { json: string; locale: string; caliber: 'light' | 'heavy' } = $props();

	let result = $state<{ blocks: RenderedBlock[]; notes: Footnote[] } | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(false);

	$effect(() => {
		const body = new FormData();
		body.append('blocks', json);
		body.append('locale', locale);
		const timer = setTimeout(async () => {
			loading = true;
			try {
				const res = await fetch('?/preview', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
				const r = deserialize(await res.text());
				if (r.type === 'success') (result = (r.data as { preview: typeof result }).preview), (error = null);
				else if (r.type === 'failure') error = String((r.data as { error?: string })?.error ?? '');
			} catch {
				error = m.task_error();
			} finally {
				loading = false;
			}
		}, 500);
		return () => clearTimeout(timer);
	});
</script>

<div class="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
	<p class="mb-3 h-4 text-[11px] text-zinc-500">{loading ? m.blocks_preview_loading() : ''}</p>
	{#if error}<p role="alert" class="mb-3 text-sm text-rose-300">{error}</p>{/if}
	{#if result}
		<PublicArticleBody blocks={result.blocks} {caliber} lang={locale === 'en' ? 'en' : 'pl'} />
		<PublicFootnotes notes={result.notes} lang={locale === 'en' ? 'en' : 'pl'} />
	{/if}
</div>
