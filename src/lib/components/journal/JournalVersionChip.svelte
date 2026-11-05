<script lang="ts">
	import Hammer from 'lucide-svelte/icons/hammer';
	import Watch from 'lucide-svelte/icons/watch';
	import { m } from '$lib/paraglide/messages.js';
	import type { EditorRow } from '$lib/server/journal';
	import JournalStateBadge from './JournalStateBadge.svelte';

	/** A version at a glance in a collapsed back-office row: its calibre icon, state badge and approvals, or a dash if it does not exist. */
	let { row, caliber }: { row: EditorRow | null; caliber: 'light' | 'heavy' } = $props();
	const icon = $derived(caliber === 'heavy' ? 'text-crimson-300' : 'text-amber-300');
	const name = $derived(caliber === 'heavy' ? m.journal_caliber_heavy() : m.journal_caliber_light());
</script>

<span class="inline-flex items-center gap-1.5" title={name}>
	{#if caliber === 'light'}<Hammer class="h-3.5 w-3.5 {icon}" />{:else}<Watch class="h-3.5 w-3.5 {icon}" />{/if}
	{#if row}
		<JournalStateBadge status={row.status} revision={row.revision} published_revision={row.published_revision} approvals={row.approvals} required={row.required} />
		<span class="font-mono text-[11px] text-zinc-400" title={m.journal_approvals_hint()}>{row.approvals}/{row.required}</span>
	{:else}
		<span class="text-xs text-zinc-600" title={m.journal_no_version()}>—</span>
	{/if}
</span>
