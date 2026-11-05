<script lang="ts">
	import Check from 'lucide-svelte/icons/check';
	import Copy from 'lucide-svelte/icons/copy';
	import { m } from '$lib/paraglide/messages.js';
	import type { JournalLang } from '$lib/journal-paths';

	/** The feed address in a read-only field with a Copy button; selecting the field works where the clipboard does not. */
	let { url, lang }: { url: string; lang: JournalLang } = $props();
	const o = $derived({ locale: lang });
	let copied = $state(false);
	let field = $state<HTMLInputElement>();

	async function copy() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			field?.select();
		}
	}
</script>

<div class="flex flex-wrap gap-2">
	<input bind:this={field} readonly value={url} aria-label={m.pub_follow_feed_label({}, o)} onfocus={(e) => e.currentTarget.select()}
		class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none" />
	<button type="button" onclick={copy} class="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400">
		{#if copied}<Check class="h-4 w-4" />{m.pub_follow_copied({}, o)}{:else}<Copy class="h-4 w-4" />{m.pub_follow_copy({}, o)}{/if}
	</button>
</div>
