<script lang="ts">
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import Swords from 'lucide-svelte/icons/swords';
	import Wheat from 'lucide-svelte/icons/wheat';
	import { m } from '$lib/paraglide/messages.js';
	import HeroCarousel from '$lib/components/HeroCarousel.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Przymierze Lemiesza — Dwie korony. Jeden wybór.</title>
	<meta name="description" content={m.landing_close_body()} />
	<meta property="og:image" content="/images/kaszanka_sacred_life.jpg" />
</svelte:head>

<!-- HERO CAROUSEL: HOME OVERVIEW -->
<HeroCarousel currentId="home" />

<!-- MANIFESTO & THE COVENANT OF THE PLOWSHARE -->
<section class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
	<div class="grid gap-12 lg:grid-cols-2 lg:items-center">
		<div>
			<span class="text-xs font-semibold tracking-[0.25em] text-amber-400 uppercase">Doktryna Pokoju</span>
			<h2 class="mt-3 font-serif text-3xl font-bold tracking-tight text-white sm:text-5xl">
				{m.home_manifesto_title()}
			</h2>
			<p class="mt-6 text-lg leading-relaxed text-zinc-300">
				{m.home_manifesto_lead()}
			</p>

			<blockquote class="mt-8 border-l-2 border-amber-500/60 pl-6 font-serif text-xl italic leading-relaxed text-zinc-200">
				{m.home_manifesto_quote()}
				<span class="mt-2 block font-sans text-xs tracking-wider text-amber-400 not-italic uppercase">Księga Izajasza 2, 4</span>
			</blockquote>
		</div>

		<div class="grid gap-6">
			<!-- PŁUG -->
			<div class="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-zinc-900/60 to-zinc-950 p-6 sm:p-8">
				<div class="flex items-center gap-3">
					<span class="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400">
						<Wheat class="h-5 w-5" />
					</span>
					<h3 class="font-serif text-2xl font-bold text-amber-300">Droga Lemiesza</h3>
				</div>
				<p class="mt-4 text-sm leading-relaxed text-zinc-300">
					Praca, rodzina, rola i własny warsztat. Płód Lemiesza karmi naród, buduje akumulację rodzimego kapitału i zapewnia schronienie w chwili kryzysu. Prawdziwa obronność to niestrawny jeż na własnej ziemi.
				</p>
			</div>

			<!-- MIECZ -->
			<div class="rounded-2xl border border-rose-500/30 bg-rose-950/10 p-6 sm:p-8">
				<div class="flex items-center gap-3">
					<span class="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300">
						<Swords class="h-5 w-5" />
					</span>
					<h3 class="font-serif text-2xl font-bold text-rose-200">Droga Miecza</h3>
				</div>
				<p class="mt-4 text-sm leading-relaxed text-zinc-400">
					Wyścig zbrojeń na zagraniczny kredyt, oddanie klucza do pokoju obcym sztabom, drenaż demografii i rola poligonu atomowego dla odległych hegemorów morskich.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- THREE PILLARS OVERVIEW -->
<section class="border-y border-zinc-900 bg-zinc-900/30 py-16 sm:py-24">
	<div class="mx-auto max-w-7xl px-4 sm:px-6">
		<div class="max-w-3xl">
			<span class="text-xs font-semibold tracking-[0.25em] text-amber-400 uppercase">Trzy Wymiary</span>
			<h2 class="mt-3 font-serif text-3xl font-bold tracking-tight text-white sm:text-5xl">{m.home_pillars_title()}</h2>
			<p class="mt-4 text-lg leading-relaxed text-zinc-300">{m.home_pillars_lead()}</p>
		</div>

		<div class="mt-12 grid gap-6 sm:grid-cols-3">
			<a
				href="/neutralna-polska"
				class="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 sm:p-8 transition-all hover:border-amber-500/60 hover:bg-zinc-900/40"
			>
				<div>
					<span class="text-xs font-semibold uppercase tracking-wider text-amber-400">Architektura Bezpieczeństwa</span>
					<h3 class="mt-3 font-serif text-2xl font-bold text-white group-hover:text-amber-300 transition-colors">
						Neutralna Polska
					</h3>
					<p class="mt-3 text-sm text-zinc-400 leading-relaxed">
						Doktryna Jeża zamiast zadłużonej Sparty. Teoria gier, asymetryczna obrona terenu, schrony i V Konwencja Haska.
					</p>
				</div>
				<span class="mt-8 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
					Odkryj doktrynę <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1" />
				</span>
			</a>

			<a
				href="/za-i-przeciw"
				class="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 sm:p-8 transition-all hover:border-amber-500/60 hover:bg-zinc-900/40"
			>
				<div>
					<span class="text-xs font-semibold uppercase tracking-wider text-amber-400">1 Księga Samuela 8</span>
					<h3 class="mt-3 font-serif text-2xl font-bold text-white group-hover:text-amber-300 transition-colors">
						Za i Przeciw
					</h3>
					<p class="mt-3 text-sm text-zinc-400 leading-relaxed">
						Cena korony wyliczona punkt po punkcie: synowie, córki, ziemia, dziesięcina i wolność. Dwie korony i rachunek kosztów.
					</p>
				</div>
				<span class="mt-8 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
					Przeczytaj analizę <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1" />
				</span>
			</a>

			<a
				href="/polskie-mocarstwo"
				class="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 sm:p-8 transition-all hover:border-amber-500/60 hover:bg-zinc-900/40"
			>
				<div>
					<span class="text-xs font-semibold uppercase tracking-wider text-amber-400">Geopolityka i Suwerenność</span>
					<h3 class="mt-3 font-serif text-2xl font-bold text-white group-hover:text-amber-300 transition-colors">
						Polskie Mocarstwo
					</h3>
					<p class="mt-3 text-sm text-zinc-400 leading-relaxed">
						Imadło geopolityczne i dekonstrukcja mitu niepodległości. Prawdziwa suwerenność oparta na płodności i rodzimym kapitale.
					</p>
				</div>
				<span class="mt-8 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
					Zobacz dekonstrukcję <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1" />
				</span>
			</a>
		</div>
	</div>
</section>

<!-- CLOSING: TWO CROWNS -->
<section class="relative isolate overflow-hidden">
	<img src="/images/two_crowns_hero.jpg" alt="" aria-hidden="true" class="absolute inset-0 -z-20 h-full w-full object-cover opacity-25 blur-sm" loading="lazy" />
	<div class="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-950 via-zinc-950/80 to-zinc-950"></div>
	<div class="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
		<h2 class="font-serif text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">{m.landing_close_title()}</h2>
		<p class="mt-6 text-lg leading-relaxed text-zinc-300">{m.landing_close_body()}</p>
		<a
			href={data?.user ? '/dashboard' : '/login'}
			class="mt-10 inline-flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-5 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/20"
		>
			{data?.user ? m.landing_cta_dashboard() : m.landing_cta_signin()} <ArrowRight class="h-4 w-4" />
		</a>
	</div>
</section>
