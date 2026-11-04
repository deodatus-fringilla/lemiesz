<script lang="ts">
	import ExternalLink from 'lucide-svelte/icons/external-link';
	import { m } from '$lib/paraglide/messages.js';
	import type { JournalLang } from '$lib/journal-paths';
	import { linkTypeLabel } from '../journal-ui';
	import type { LibraryEntry } from './types';

	let { item, lang }: { item: LibraryEntry; lang: JournalLang } = $props();
</script>

<li class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
	<p class="text-[11px] font-semibold tracking-wider text-amber-400/90 uppercase">{linkTypeLabel(item.media_type, lang)}{item.language ? ` · ${item.language}` : ''}</p>
	<a href={item.url} rel="noopener noreferrer nofollow" target="_blank" class="mt-1 inline-flex items-start gap-1.5 text-lg font-semibold text-zinc-100 hover:text-amber-300">
		{item.title}<ExternalLink class="mt-1.5 h-3.5 w-3.5 shrink-0" />
	</a>
	<p class="text-sm text-zinc-400">{item.artist_or_author}</p>
	<p class="mt-2 text-sm leading-relaxed text-zinc-300">{item.public_note}</p>
	{#if item.broken}<p class="mt-2 text-xs text-rose-300/90">{m.pub_link_maybe_broken({}, { locale: lang })}</p>{/if}
	{#if item.archive_url}
		<a href={item.archive_url} rel="noopener noreferrer nofollow" target="_blank" class="mt-2 inline-block text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300">{m.pub_archive({}, { locale: lang })}</a>
	{/if}
</li>
