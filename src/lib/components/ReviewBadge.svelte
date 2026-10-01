<script lang="ts">
	import { reviewLabel } from '$lib/i18n/labels';

	let { state }: { state: string } = $props();

	const styles: Record<string, string> = {
		human_approved: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
		ai_verified: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
		draft: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
		flagged: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
		stale: 'bg-rose-500/10 text-rose-300 border-rose-500/30'
	};
</script>

<span
	class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {styles[state] ??
		styles.draft}"
>
	{reviewLabel(state)}
</span>
