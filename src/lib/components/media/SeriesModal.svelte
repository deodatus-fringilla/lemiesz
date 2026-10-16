<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';

	let {
		open = false,
		title = '',
		onClose,
		children
	}: {
		open: boolean;
		title?: string;
		onClose: () => void;
		children?: Snippet;
	} = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			onClose();
		}
	}

	$effect(() => {
		if (open && typeof document !== 'undefined') {
			const prevOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = prevOverflow;
			};
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-md bg-black/80 transition-opacity duration-200"
		role="dialog"
		aria-modal="true"
		aria-label={title || m.series_open_carousel()}
	>
		<!-- Backdrop click interceptor -->
		<button
			type="button"
			class="fixed inset-0 h-full w-full cursor-default bg-transparent -z-10"
			tabindex="-1"
			onclick={onClose}
			aria-label={m.series_close()}
		></button>

		<!-- Modal Container -->
		<div
			class="relative flex flex-col max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl text-zinc-100"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-zinc-800/80 px-5 py-3.5 bg-zinc-900/60">
				<h2 class="text-base font-bold text-zinc-100 truncate pr-4">
					{title}
				</h2>
				<button
					type="button"
					class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
					onclick={onClose}
					aria-label={m.series_close()}
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Body -->
			<div class="overflow-y-auto p-4 sm:p-6">
				{#if children}
					{@render children()}
				{/if}
			</div>
		</div>
	</div>
{/if}
