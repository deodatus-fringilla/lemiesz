<script lang="ts">
	import type { KuzniaDeliberation } from '$lib/server/kuznia';
	import Swords from 'lucide-svelte/icons/swords';
	import PenLine from 'lucide-svelte/icons/pen-line';
	import CheckCircle2 from 'lucide-svelte/icons/check-circle-2';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		deliberation: KuzniaDeliberation;
	}

	let { deliberation }: Props = $props();
</script>

<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs">
	<div class="flex items-center gap-2">
		<span class="font-medium text-zinc-400">{m.kuznia_bridge_title()}:</span>
		<div class="flex flex-wrap items-center gap-2">
			<a
				href="/arguments?q={encodeURIComponent(deliberation.title)}"
				class="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-zinc-200 transition hover:border-amber-500/50 hover:bg-zinc-800"
			>
				<Swords class="size-3 text-amber-400" />
				<span>{m.kuznia_bridge_arg()}</span>
			</a>
			<a
				href="/content?prompt={encodeURIComponent('Przygotuj post kampanijny oparty o motyw: ' + deliberation.title + (deliberation.key_quote ? ' - cytat: ' + deliberation.key_quote : ''))}"
				class="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-zinc-200 transition hover:border-amber-500/50 hover:bg-zinc-800"
			>
				<PenLine class="size-3 text-amber-400" />
				<span>{m.kuznia_bridge_draft()}</span>
			</a>
		</div>
	</div>

	<div class="flex items-center gap-2">
		{#if deliberation.status === 'human_approved'}
			<span class="inline-flex items-center gap-1 rounded bg-emerald-950/60 px-2 py-0.5 text-[11px] font-medium text-emerald-300 border border-emerald-800/50">
				<CheckCircle2 class="size-3 text-emerald-400" />
				<span>Zatwierdzony kanon</span>
			</span>
		{:else}
			<form method="POST" action="?/approve">
				<input type="hidden" name="id" value={deliberation.id} />
				<button
					type="submit"
					class="inline-flex items-center gap-1 rounded bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-emerald-600 hover:text-white cursor-pointer transition"
				>
					<CheckCircle2 class="size-3" />
					<span>Zatwierdź jako kanon</span>
				</button>
			</form>
		{/if}
	</div>
</div>
