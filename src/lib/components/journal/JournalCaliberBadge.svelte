<script lang="ts">
	import Hammer from 'lucide-svelte/icons/hammer';
	import Watch from 'lucide-svelte/icons/watch';
	import { m } from '$lib/paraglide/messages.js';

	/** Light = lekki kaliber ("jak budowa cepa"), heavy = ciężki kaliber ("jak szwajcarski zegarek"). */
	/** `lang` makes public pages follow the URL's language instead of the app's language cookie. */
	let { caliber, lang }: { caliber: 'light' | 'heavy'; lang?: 'pl' | 'en' } = $props();
	const o = $derived(lang ? { locale: lang } : {});
</script>

<span
	class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap {caliber === 'light'
		? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
		: 'border-crimson-500/50 bg-crimson-500/15 text-crimson-300'}"
	title={caliber === 'light' ? m.journal_caliber_light_hint({}, o) : m.journal_caliber_heavy_hint({}, o)}
>
	{#if caliber === 'light'}<Hammer class="h-3 w-3" />{:else}<Watch class="h-3 w-3" />{/if}
	{caliber === 'light' ? m.journal_caliber_light({}, o) : m.journal_caliber_heavy({}, o)}
</span>
