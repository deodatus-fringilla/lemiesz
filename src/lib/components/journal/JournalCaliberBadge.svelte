<script lang="ts">
	import Hammer from 'lucide-svelte/icons/hammer';
	import Watch from 'lucide-svelte/icons/watch';
	import { m } from '$lib/paraglide/messages.js';

	/** Light = lekki kaliber ("jak budowa cepa"), heavy = ciężki kaliber ("jak szwajcarski zegarek"). */
	let { caliber }: { caliber: 'light' | 'heavy' } = $props();
</script>

<span
	class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap {caliber === 'light'
		? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
		: 'border-crimson-500/50 bg-crimson-500/15 text-crimson-300'}"
	title={caliber === 'light' ? m.journal_caliber_light_hint() : m.journal_caliber_heavy_hint()}
>
	{#if caliber === 'light'}<Hammer class="h-3 w-3" />{:else}<Watch class="h-3 w-3" />{/if}
	{caliber === 'light' ? m.journal_caliber_light() : m.journal_caliber_heavy()}
</span>
