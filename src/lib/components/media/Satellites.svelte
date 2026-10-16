<script lang="ts">
	import { ArrowLeft, ArrowRight, Check, Copy, Download, Sparkles } from 'lucide-svelte';
	import type { PosterRecord, SatellitePair } from '$lib/server/posters';
	import { m } from '$lib/paraglide/messages.js';
	import DualLensSwitcher from './DualLensSwitcher.svelte';

	let {
		pairs = [],
		planet = null,
		initialStep = 0,
		initialLayer = 'allegory'
	}: {
		pairs: SatellitePair[];
		planet?: PosterRecord | null;
		initialStep?: number;
		initialLayer?: 'allegory' | 'realism';
	} = $props();

	let stepIndex = $state(0);
	let activeLayer = $state<'allegory' | 'realism'>('allegory');
	let copied = $state(false);

	$effect(() => {
		stepIndex = initialStep;
	});

	$effect(() => {
		activeLayer = initialLayer;
	});

	const totalSteps = $derived(pairs.length);
	const currentPair = $derived(pairs[stepIndex] ?? null);
	const currentPoster = $derived(
		currentPair
			? activeLayer === 'allegory'
				? (currentPair.allegory ?? currentPair.realism)
				: (currentPair.realism ?? currentPair.allegory)
			: null
	);

	const currentMoral = $derived(
		currentPair ? currentPair.moral_quote_pl ?? currentPoster?.moral_quote_pl ?? '' : ''
	);

	function prevStep() {
		if (stepIndex > 0) stepIndex--;
	}

	function nextStep() {
		if (stepIndex < totalSteps - 1) stepIndex++;
	}

	function goToStep(idx: number) {
		if (idx >= 0 && idx < totalSteps) stepIndex = idx;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') prevStep();
		else if (e.key === 'ArrowRight') nextStep();
	}

	async function copyMoral() {
		if (!currentMoral) return;
		try {
			await navigator.clipboard.writeText(currentMoral);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2500);
		} catch {
			// Clipboard API might be restricted
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex flex-col space-y-5">
	<!-- Top Controls: Step counter & Dual-lens perspective switcher -->
	<div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
		<div class="flex items-center gap-2">
			<span class="rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300">
				{m.series_step_counter({ current: String(stepIndex + 1), total: String(totalSteps) })}
			</span>
			{#if planet}
				<span class="hidden sm:inline-block text-xs text-zinc-400 font-mono">
					{planet.title}
				</span>
			{/if}
		</div>

		<!-- Dual-Lens Switcher (Single Responsibility) -->
		<DualLensSwitcher bind:activeLayer />
	</div>

	<!-- Main Slide Display -->
	{#if currentPoster}
		<div class="grid gap-6 lg:grid-cols-12 items-start">
			<!-- Image Section (7 cols) -->
			<div class="lg:col-span-7 flex flex-col space-y-2">
				<div class="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-md">
					<img
						src={currentPoster.image_path}
						alt={currentPoster.title}
						class="h-full w-full object-cover transition-opacity duration-300"
					/>
					<span class="absolute top-3 left-3 rounded-full border border-black/40 bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur">
						{activeLayer === 'allegory' ? m.series_layer_allegory() : m.series_layer_realism()}
					</span>
				</div>

				<div class="flex items-center justify-between text-[11px] text-zinc-500 px-1">
					<span class="font-mono">{currentPoster.image_path}</span>
					<a
						href={currentPoster.image_path}
						download
						target="_blank"
						rel="noreferrer"
						class="inline-flex items-center gap-1 hover:text-amber-300 transition-colors"
					>
						<Download class="h-3 w-3" />
						{m.series_download_frame()}
					</a>
				</div>
			</div>

			<!-- Commentary & Educational Moral Section (5 cols) -->
			<div class="lg:col-span-5 flex flex-col justify-between space-y-4">
				<div class="space-y-3">
					<div class="space-y-1">
						<span class="text-xs uppercase tracking-wider text-amber-400 font-bold">
							{currentPoster.layer === 'allegory' ? 'Alegoria Leśna' : 'Realia Bezpieczeństwa'}
						</span>
						<h3 class="text-lg font-bold text-zinc-100 leading-snug">
							{currentPoster.title}
						</h3>
					</div>

					{#if currentPoster.caption_pl}
						<div class="rounded-lg bg-zinc-900/60 border border-zinc-800/80 p-3 text-xs leading-relaxed text-zinc-300">
							<strong class="text-zinc-400 block mb-1">Wyjaśnienie:</strong>
							{currentPoster.caption_pl}
						</div>
					{/if}

					{#if currentPoster.symbolism_notes}
						<p class="text-xs italic text-zinc-400">
							{currentPoster.symbolism_notes}
						</p>
					{/if}
				</div>

				<!-- Highlighted Moral Quote Box -->
				{#if currentMoral}
					<div class="relative rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-zinc-950/80 p-4 shadow-sm">
						<div class="flex items-center justify-between pb-1.5">
							<div class="flex items-center gap-1.5 text-xs font-bold text-amber-300">
								<Sparkles class="h-3.5 w-3.5" />
								{m.series_moral_label()}
							</div>
							<button
								type="button"
								class="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-200 transition-colors"
								onclick={copyMoral}
							>
								{#if copied}
									<Check class="h-3.5 w-3.5 text-emerald-400" />
									<span class="text-emerald-400">{m.series_copied_moral()}</span>
								{:else}
									<Copy class="h-3.5 w-3.5" />
									<span>Kopiuj</span>
								{/if}
							</button>
						</div>
						<blockquote class="text-xs font-serif italic text-zinc-200 leading-relaxed pt-1">
							„{currentMoral}”
						</blockquote>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Bottom Carousel Navigation Strip -->
	<div class="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 pt-4">
		<!-- Step Indicators (Jump to step) -->
		<div class="flex items-center gap-2">
			{#each pairs as p, idx (p.pair_key)}
				<button
					type="button"
					class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all {idx === stepIndex
						? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
						: 'border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
					onclick={() => goToStep(idx)}
				>
					<span class="h-1.5 w-1.5 rounded-full {idx === stepIndex ? 'bg-amber-400' : 'bg-zinc-600'}"></span>
					<span>Krok {idx + 1}</span>
				</button>
			{/each}
		</div>

		<!-- Prev / Next Buttons -->
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
				disabled={stepIndex <= 0}
				onclick={prevStep}
			>
				<ArrowLeft class="h-3.5 w-3.5" />
				{m.series_prev()}
			</button>

			<button
				type="button"
				class="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 disabled:pointer-events-none transition-colors"
				disabled={stepIndex >= totalSteps - 1}
				onclick={nextStep}
			>
				{m.series_next()}
				<ArrowRight class="h-3.5 w-3.5" />
			</button>
		</div>
	</div>
</div>
