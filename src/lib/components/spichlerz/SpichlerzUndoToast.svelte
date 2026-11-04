<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { UndoToast } from './task-ops.svelte';

	let { toast }: { toast: UndoToast } = $props();
</script>

{#if toast.current}
	<div
		role="status"
		class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-2.5 text-xs shadow-2xl {toast.isError
			? 'border-rose-500/40 bg-rose-950 text-rose-200'
			: 'border-zinc-700 bg-zinc-900 text-zinc-100'}"
	>
		<span>{toast.current.label}</span>
		{#if toast.current.undo}
			<button
				type="button"
				onclick={async () => {
					const undo = toast.current?.undo;
					toast.dismiss();
					await undo?.();
				}}
				class="font-semibold text-amber-400 hover:text-amber-300"
			>
				{m.task_undo()}
			</button>
		{/if}
	</div>
{/if}
