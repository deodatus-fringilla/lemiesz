<script lang="ts">
	import { enhance } from '$app/forms';
	import ExternalLink from 'lucide-svelte/icons/external-link';
	import Pencil from 'lucide-svelte/icons/pencil';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import { m } from '$lib/paraglide/messages.js';
	import type { MediaRecord } from '$lib/server/media';
	import ReviewBadge from '../ReviewBadge.svelte';
	import JournalLinkForm from './JournalLinkForm.svelte';
	import { linkTypeLabel } from './journal-ui';

	let { links, linkTypes, error = null }: { links: MediaRecord[]; linkTypes: readonly string[]; error?: string | null } = $props();
	let editing = $state<number | null>(null);
	const small = 'rounded-lg border px-2.5 py-1 text-xs font-medium transition';
</script>

{#if links.length === 0}
	<p class="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">{m.journal_links_empty()}</p>
{:else}
	<ul class="space-y-2">
		{#each links as l (l.id)}
			<li class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
				{#if editing === l.id}
					<JournalLinkForm {linkTypes} link={l} {error} ondone={() => (editing = null)} />
				{:else}
					<div class="flex flex-wrap items-start gap-2">
						<span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300">{linkTypeLabel(l.media_type)}</span>
						<div class="min-w-0 flex-1">
							<a href={l.url} target="_blank" rel="noopener noreferrer nofollow" class="inline-flex items-center gap-1 font-medium text-zinc-100 hover:text-amber-300">
								{l.title}<ExternalLink class="h-3 w-3 shrink-0" />
							</a>
							<p class="text-xs text-zinc-400">{l.artist_or_author}{l.platform !== 'web' ? ` · ${m.journal_link_playable()}` : ''}</p>
							{#if l.public_note}<p class="mt-1 text-sm text-zinc-300">{l.public_note}</p>{/if}
						</div>
						<ReviewBadge state={l.status} />
					</div>
					<div class="mt-2 flex flex-wrap gap-1.5">
						{#if l.status !== 'human_approved'}
							<form method="POST" action="?/setLinkStatus" use:enhance><input type="hidden" name="mediaId" value={l.id} /><input type="hidden" name="to" value="human_approved" />
								<button class="{small} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20">{m.journal_approve()}</button></form>
						{/if}
						{#if l.status !== 'flagged'}
							<form method="POST" action="?/setLinkStatus" use:enhance><input type="hidden" name="mediaId" value={l.id} /><input type="hidden" name="to" value="flagged" />
								<button class="{small} border-zinc-700 text-zinc-300 hover:bg-zinc-800">{m.journal_flag()}</button></form>
						{/if}
						<button type="button" onclick={() => (editing = l.id)} class="{small} inline-flex items-center gap-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"><Pencil class="h-3 w-3" />{m.journal_edit()}</button>
						<form method="POST" action="?/deleteLink" use:enhance onsubmit={(e) => !confirm(m.journal_link_delete_confirm()) && e.preventDefault()}>
							<input type="hidden" name="mediaId" value={l.id} />
							<button class="{small} inline-flex items-center gap-1 border-rose-500/25 text-rose-300 hover:bg-rose-500/10"><Trash2 class="h-3 w-3" />{m.journal_delete()}</button>
						</form>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
