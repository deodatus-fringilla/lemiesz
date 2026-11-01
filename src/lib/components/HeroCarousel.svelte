<script lang="ts">
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import { goto } from '$app/navigation';
	import { allSlides, topicSlides } from '$lib/state/heroCarousel.svelte';
	import TopicCard from '$lib/components/TopicCard.svelte';

	interface Props {
		currentId: 'home' | 'neutralna_polska' | 'za_i_przeciw' | 'polskie_mocarstwo' | string;
		scrollTarget?: string;
	}

	let { currentId, scrollTarget = '#doctrine' }: Props = $props();

	const currentIndex = $derived(
		allSlides.findIndex((s) => s.id === currentId) >= 0
			? allSlides.findIndex((s) => s.id === currentId)
			: 0
	);
	const currentSlide = $derived(allSlides[currentIndex]);
	const prevIndex = $derived((currentIndex - 1 + allSlides.length) % allSlides.length);
	const nextIndex = $derived((currentIndex + 1) % allSlides.length);
	const prevSlide = $derived(allSlides[prevIndex]);
	const nextSlide = $derived(allSlides[nextIndex]);
	const isHome = $derived(currentId === 'home');

	// Touch gesture support for mobile / tablet swiping
	let touchStartX = 0;
	let touchStartY = 0;

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function handleTouchEnd(e: TouchEvent) {
		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const diffX = touchEndX - touchStartX;
		const diffY = touchEndY - touchStartY;

		// Horizontal swipe must dominate vertical scroll and exceed 45px
		if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 45) {
			if (diffX < 0) {
				// Swiped left -> navigate to next slide
				if (nextSlide.href) {
					goto(nextSlide.href);
				}
			} else {
				// Swiped right -> navigate to previous slide
				if (prevSlide.href) {
					goto(prevSlide.href);
				}
			}
		}
	}
</script>

<section
	class="relative isolate flex h-[calc(100dvh-var(--header-height,105px))] items-end overflow-hidden pb-4 sm:pb-16 touch-pan-y"
	aria-label="Karuzela tematów"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
>
	<!-- Background image filling 100% of the screen under the navbar -->
	<img
		src={currentSlide.image}
		alt={currentSlide.alt()}
		class="absolute inset-0 -z-20 h-full w-full object-cover object-center"
		fetchpriority="high"
		loading="eager"
	/>

	{#if isHome}
		<div class="absolute inset-0 -z-10 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
	{:else}
		<div class="absolute inset-0 -z-10 bg-gradient-to-t from-black/25 via-transparent to-transparent"></div>
		<div class="absolute inset-0 -z-10 bg-gradient-to-r from-black/15 via-transparent to-transparent"></div>
	{/if}

	<div class="mx-auto w-full max-w-7xl px-3 sm:px-6">
		{#if isHome}
			<!-- Home Overview: 3 Topic Cards -->
			<div class="grid gap-2.5 sm:gap-4 sm:grid-cols-3 mb-12 sm:mb-0">
				{#each topicSlides as topic (topic.id)}
					<TopicCard {topic} href={topic.href} />
				{/each}
			</div>
		{:else}
			<!-- Topic Detail View: Single TopicCard with down arrow to scroll to section below -->
			<div class="max-w-sm mb-12 sm:mb-0">
				<TopicCard
					topic={currentSlide}
					arrowDirection="down"
					onclick={() => {
						const target = document.querySelector(scrollTarget);
						target?.scrollIntoView({ behavior: 'smooth' });
					}}
				/>
			</div>
		{/if}
	</div>

	<!-- Carousel controls: Prev, Slide Indicator Dots, Next -->
	<div class="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 sm:bottom-8 sm:right-8 sm:gap-2">
		<a
			href={prevSlide.href ?? '/'}
			class="flex h-8 w-8 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-zinc-950/40 text-zinc-300 backdrop-blur-md transition-colors hover:border-amber-500/60 hover:bg-zinc-900/60 hover:text-amber-300"
			aria-label="Poprzedni slajd: {prevSlide.label()}"
		>
			<ChevronLeft class="h-4 w-4" />
		</a>
		<div class="flex items-center gap-1.5 px-1">
			{#each allSlides as slide, i (slide.id)}
				<a
					href={slide.href ?? '/'}
					class="h-2 cursor-pointer rounded-full transition-all {slide.id === currentId
						? 'w-5 sm:w-6 bg-amber-400 shadow-sm shadow-amber-400/50'
						: 'w-2 bg-white/30 hover:bg-white/60'}"
					aria-label="Slajd {i + 1}: {slide.label()}"
					aria-current={slide.id === currentId ? 'page' : undefined}
				></a>
			{/each}
		</div>
		<a
			href={nextSlide.href ?? '/'}
			class="flex h-8 w-8 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-zinc-950/40 text-zinc-300 backdrop-blur-md transition-colors hover:border-amber-500/60 hover:bg-zinc-900/60 hover:text-amber-300"
			aria-label="Następny slajd: {nextSlide.label()}"
		>
			<ChevronRight class="h-4 w-4" />
		</a>
	</div>
</section>
