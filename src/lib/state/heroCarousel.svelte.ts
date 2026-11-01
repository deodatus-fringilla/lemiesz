import { m } from '$lib/paraglide/messages.js';

export interface CarouselSlide {
	id: string;
	href?: string;
	label: () => string;
	image: string;
	alt: () => string;
	tagline?: () => string;
	eyebrow?: () => string;
	titleA?: () => string;
	titleB?: () => string;
	lead?: () => string;
	ctaText?: () => string;
	ctaHref?: string;
}

/**
 * Home overview slide with static/images/kaszanka_sacred_life.jpg background.
 * Displays the 3 big interactive topic labels.
 */
export const homeSlide: CarouselSlide = {
	id: 'home',
	href: '/',
	label: () => 'Strona Główna',
	image: '/images/kaszanka_sacred_life.jpg',
	alt: () => 'Przymierze Lemiesza — Płodność Lemiesza i Świętość Zwykłego Życia',
	eyebrow: () => 'PRZYMIERZE LEMIESZA',
	titleA: () => 'Dwie korony.',
	titleB: () => 'Jeden wybór.',
	lead: () => 'Trzy drogi dla przyszłości Rzeczypospolitej. Wybierz perspektywę, aby poznać fundamenty doktryny, analizy i argumenty:'
};

/**
 * The 3 topic slides corresponding to the top navbar labels.
 */
export const topicSlides: CarouselSlide[] = [
	{
		id: 'neutralna_polska',
		href: '/neutralna-polska',
		label: () => (m.nav_neutral_poland ? m.nav_neutral_poland() : 'Neutralna Polska'),
		image: '/images/doktryna-jeza/hedgehog_planet_hero.jpg',
		alt: () => 'Neutralna Polska — Doktryna Jeża',
		tagline: () => 'Doktryna Jeża',
		eyebrow: () => (m.landing_hedgehog_eyebrow ? m.landing_hedgehog_eyebrow() : 'Architektura Bezpieczeństwa'),
		titleA: () => 'Doktryna Jeża.',
		titleB: () => (m.nav_neutral_poland ? m.nav_neutral_poland() : 'Neutralna Polska'),
		lead: () =>
			m.landing_hedgehog_lead
				? m.landing_hedgehog_lead()
				: 'Neutralność nie opiera się na łasce sąsiada, lecz na twardej teorii gier: inwazja musi być nieopłacalna. Asymetryczna obrona terytorialna (wzór szwajcarski) sprawia, że koszt połknięcia jeża przewyższa zyski agresora.',
		ctaText: () => 'Poznaj doktrynę',
		ctaHref: '/neutralna-polska'
	},
	{
		id: 'za_i_przeciw',
		href: '/za-i-przeciw',
		label: () => (m.nav_pros_and_cons ? m.nav_pros_and_cons() : 'Za i Przeciw'),
		image: '/images/two_crowns_hero.jpg',
		alt: () => (m.landing_hero_alt ? m.landing_hero_alt() : 'Dwie korony — Za i Przeciw'),
		tagline: () => '1 Księga Samuela 8',
		eyebrow: () => m.landing_eyebrow(),
		titleA: () => m.landing_title_a(),
		titleB: () => m.landing_title_b(),
		lead: () => m.landing_lead(),
		ctaText: () => m.landing_cta_read(),
		ctaHref: '/za-i-przeciw'
	},
	{
		id: 'polskie_mocarstwo',
		href: '/polskie-mocarstwo',
		label: () => (m.nav_polish_power ? m.nav_polish_power() : 'Polskie Mocarstwo'),
		image: '/images/imadlo_geopolityczne_hero.jpg',
		alt: () => 'Polskie Mocarstwo — Imadło Geopolityczne',
		tagline: () => 'Imadło Geopolityczne',
		eyebrow: () => 'Geopolityka i Suwerenność',
		titleA: () => 'Imadło Geopolityczne.',
		titleB: () => (m.nav_polish_power ? m.nav_polish_power() : 'Polskie Mocarstwo'),
		lead: () =>
			'Realizm polityczny w kleszczach imperiów. Budowa suwerenności i siły gospodarczej zamiast romantycznych iluzji.',
		ctaText: () => 'Zobacz analizę',
		ctaHref: '/polskie-mocarstwo'
	}
];

/**
 * All slides in the carousel.
 */
export const allSlides: CarouselSlide[] = [homeSlide, ...topicSlides];

class HeroCarouselState {
	currentId = $state<string>('home');

	get isHome(): boolean {
		return this.currentId === 'home';
	}

	get currentSlide(): CarouselSlide {
		return allSlides.find((s) => s.id === this.currentId) ?? homeSlide;
	}

	get currentIndex(): number {
		const idx = allSlides.findIndex((s) => s.id === this.currentId);
		return idx >= 0 ? idx : 0;
	}

	setSlide(id: string) {
		if (allSlides.some((s) => s.id === id)) {
			this.currentId = id;
		}
	}

	goHome() {
		this.currentId = 'home';
	}

	next() {
		const nextIdx = (this.currentIndex + 1) % allSlides.length;
		this.currentId = allSlides[nextIdx].id;
	}

	prev() {
		const prevIdx = (this.currentIndex - 1 + allSlides.length) % allSlides.length;
		this.currentId = allSlides[prevIdx].id;
	}
}

export const heroCarousel = new HeroCarouselState();
