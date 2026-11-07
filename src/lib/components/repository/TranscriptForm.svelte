<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages.js';
	import type { TranscriptDetail } from '$lib/server/transcripts';

	let {
		transcript = null,
		folders = [],
		cancelHref
	}: {
		transcript?: TranscriptDetail | null;
		folders?: { name: string; count: number }[];
		cancelHref?: string;
	} = $props();

	const input = 'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm';
</script>

<form
	method="POST"
	action="?/saveTranscript"
	use:enhance
	class="grid gap-3 md:grid-cols-2 {transcript ? '' : 'rounded-xl border border-zinc-800 bg-zinc-900/50 p-5'}"
>
	{#if transcript}
		<input type="hidden" name="slug" value={transcript.slug} />
	{:else}
		<h2 class="text-lg font-semibold md:col-span-2">{m.tr_add()}</h2>
	{/if}

	<label class="block text-sm md:col-span-2">
		<span class="mb-1 block text-zinc-300">{m.tr_title()}</span>
		<input name="title" required value={transcript?.title ?? ''} class={input} />
	</label>

	<label class="block text-sm">
		<span class="mb-1 block text-zinc-300">{m.tr_folder()}</span>
		<input
			name="folder"
			list="tr-folders-list"
			required
			value={transcript?.folder ?? 'for_processing'}
			placeholder="for_processing / letters_archive/Prezydent/..."
			class={input}
		/>
		<datalist id="tr-folders-list">
			{#each folders as f (f.name)}<option value={f.name}></option>{/each}
		</datalist>
	</label>

	<label class="block text-sm">
		<span class="mb-1 block text-zinc-300">{m.tr_speaker()}</span>
		<input name="speaker" value={transcript?.speaker ?? ''} class={input} />
	</label>

	<label class="block text-sm">
		<span class="mb-1 block text-zinc-300">{m.tr_date()}</span>
		<input name="date" placeholder="YYYY-MM-DD" value={transcript?.date ?? ''} class={input} />
	</label>

	<label class="block text-sm">
		<span class="mb-1 block text-zinc-300">{m.tr_source_url()}</span>
		<input name="sourceUrl" type="url" value={transcript?.sourceUrl ?? ''} class={input} />
	</label>

	<label class="block text-sm md:col-span-2">
		<span class="mb-1 block text-zinc-300">{m.tr_body()}</span>
		<textarea name="body" rows="16" required class="{input} font-mono text-xs leading-relaxed">{transcript?.body ?? ''}</textarea>
	</label>

	<div class="flex gap-3 md:col-span-2">
		<button class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">{m.repo_save()}</button>
		{#if !transcript && cancelHref}
			<a href={cancelHref} class="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">{m.repo_cancel()}</a>
		{/if}
	</div>
</form>
