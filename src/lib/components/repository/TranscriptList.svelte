<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { TranscriptEntry } from '$lib/server/transcripts';

	let {
		transcripts,
		selectedId,
		link
	}: {
		transcripts: TranscriptEntry[];
		selectedId: string;
		link: (changes: Record<string, string | number>) => string;
	} = $props();
</script>

{#each transcripts as t (t.slug)}
	<li>
		<a
			href={link({ id: t.slug, new: '' })}
			aria-current={selectedId === t.slug ? 'true' : undefined}
			class="block rounded-lg border px-3 py-2 text-sm {selectedId === t.slug
				? 'border-amber-500/50 bg-amber-500/5'
				: 'border-zinc-800 hover:bg-zinc-900'}"
		>
			<div class="line-clamp-2 font-medium text-zinc-200">{t.title}</div>
			<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
				<span class="font-mono text-amber-400">{t.folder}</span>
				{#if t.date}<span>· {t.date}</span>{/if}
				<span>· {m.tr_words({ n: t.wordCount })}</span>
			</div>
		</a>
	</li>
{:else}
	<li class="text-sm text-zinc-500">{m.tr_none()}</li>
{/each}
