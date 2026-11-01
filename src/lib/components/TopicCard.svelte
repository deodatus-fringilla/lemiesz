<script lang="ts">
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import ArrowDown from 'lucide-svelte/icons/arrow-down';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import ArrowUp from 'lucide-svelte/icons/arrow-up';
	import type { CarouselSlide } from '$lib/state/heroCarousel.svelte';

	interface Props {
		topic: CarouselSlide;
		href?: string;
		arrowDirection?: 'right' | 'down' | 'left' | 'up';
		class?: string;
		onclick?: () => void;
	}

	let { topic, href, arrowDirection = 'right', class: className = '', onclick }: Props = $props();

	const targetHref = $derived(href ?? (!onclick ? topic.href : undefined));
</script>

{#if targetHref}
	<a
		href={targetHref}
		class="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/20 bg-black/20 p-4 sm:p-6 text-left shadow-lg backdrop-blur-xs transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/80 hover:bg-black/40 hover:shadow-amber-500/10 cursor-pointer {className}"
	>
		<div class="flex items-center justify-between gap-4">
			<span class="text-[11px] font-semibold uppercase tracking-wider text-amber-400 drop-shadow">
				{topic.tagline?.() ?? 'Temat'}
			</span>
			<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/25 text-zinc-200 transition-colors group-hover:border-amber-500/60 group-hover:bg-amber-500/20 group-hover:text-amber-300">
				{#if arrowDirection === 'down'}
					<ArrowDown class="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
				{:else if arrowDirection === 'left'}
					<ArrowLeft class="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
				{:else if arrowDirection === 'up'}
					<ArrowUp class="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
				{:else}
					<ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
				{/if}
			</span>
		</div>
		<h2 class="mt-3 font-serif text-2xl font-bold tracking-tight text-white drop-shadow-md transition-colors group-hover:text-amber-300 sm:mt-4 sm:text-3xl">
			{topic.label()}
		</h2>
	</a>
{:else}
	<button
		type="button"
		{onclick}
		class="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/20 bg-black/20 p-4 sm:p-6 text-left shadow-lg backdrop-blur-xs transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/80 hover:bg-black/40 hover:shadow-amber-500/10 cursor-pointer {className}"
	>
		<div class="flex items-center justify-between gap-4">
			<span class="text-[11px] font-semibold uppercase tracking-wider text-amber-400 drop-shadow">
				{topic.tagline?.() ?? 'Temat'}
			</span>
			<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/25 text-zinc-200 transition-colors group-hover:border-amber-500/60 group-hover:bg-amber-500/20 group-hover:text-amber-300">
				{#if arrowDirection === 'down'}
					<ArrowDown class="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
				{:else if arrowDirection === 'left'}
					<ArrowLeft class="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
				{:else if arrowDirection === 'up'}
					<ArrowUp class="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
				{:else}
					<ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
				{/if}
			</span>
		</div>
		<h2 class="mt-3 font-serif text-2xl font-bold tracking-tight text-white drop-shadow-md transition-colors group-hover:text-amber-300 sm:mt-4 sm:text-3xl">
			{topic.label()}
		</h2>
	</button>
{/if}
