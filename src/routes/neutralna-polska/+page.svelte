<script lang="ts">
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import Shield from 'lucide-svelte/icons/shield';
	import Swords from 'lucide-svelte/icons/swords';
	import Droplets from 'lucide-svelte/icons/droplets';
	import Activity from 'lucide-svelte/icons/activity';
	import EyeOff from 'lucide-svelte/icons/eye-off';
	import Landmark from 'lucide-svelte/icons/landmark';
	import Home from 'lucide-svelte/icons/home';
	import Radio from 'lucide-svelte/icons/radio';
	import Users from 'lucide-svelte/icons/users';
	import Scale from 'lucide-svelte/icons/scale';
	import { m } from '$lib/paraglide/messages.js';
	import HeroCarousel from '$lib/components/HeroCarousel.svelte';

	const spikes = [
		{
			num: '01',
			title: m.hedgehog_spike_1_title(),
			desc: m.hedgehog_spike_1_desc(),
			icon: Droplets,
			highlight: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
		},
		{
			num: '02',
			title: m.hedgehog_spike_2_title(),
			desc: m.hedgehog_spike_2_desc(),
			icon: Activity,
			highlight: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
		},
		{
			num: '03',
			title: m.hedgehog_spike_3_title(),
			desc: m.hedgehog_spike_3_desc(),
			icon: EyeOff,
			highlight: 'bg-crimson-500/10 text-crimson-400 border-crimson-500/30'
		},
		{
			num: '04',
			title: m.hedgehog_spike_4_title(),
			desc: m.hedgehog_spike_4_desc(),
			icon: Landmark,
			highlight: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
		},
		{
			num: '05',
			title: m.hedgehog_spike_5_title(),
			desc: m.hedgehog_spike_5_desc(),
			icon: Home,
			highlight: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
		},
		{
			num: '06',
			title: m.hedgehog_spike_6_title(),
			desc: m.hedgehog_spike_6_desc(),
			icon: Radio,
			highlight: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
		},
		{
			num: '07',
			title: m.hedgehog_spike_7_title(),
			desc: m.hedgehog_spike_7_desc(),
			icon: Users,
			highlight: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
		}
	];
</script>

<svelte:head>
	<title>{m.nav_neutral_poland()} — {m.shield_preset_hedgehog_name()} | Przymierze Lemiesza</title>
	<meta name="description" content={m.landing_hedgehog_lead()} />
	<meta property="og:image" content="/images/doktryna-jeza/hedgehog_planet_hero.jpg" />
</svelte:head>

<!-- HERO CAROUSEL: NEUTRAL POLAND -->
<HeroCarousel currentId="neutralna_polska" scrollTarget="#doctrine" />

<!-- DOCTRINE & COMPARISON: SPARTA ILLUSION VS HEDGEHOG DOCTRINE -->
<section id="doctrine" class="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
	<div class="max-w-3xl mb-12 sm:mb-16">
		<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-amber-300 uppercase">
			<Shield class="h-3.5 w-3.5" /> {m.landing_hedgehog_eyebrow()}
		</span>
		<h1 class="mt-4 font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
			{m.landing_hedgehog_title()}
		</h1>
		<p class="mt-6 text-lg leading-relaxed text-zinc-300 sm:text-xl">
			{m.landing_hedgehog_lead()}
		</p>
	</div>

	<div class="grid gap-8 md:grid-cols-2">
		<!-- SPARTA ILLUSION -->
		<div class="rounded-2xl border border-rose-500/30 bg-rose-950/10 p-6 sm:p-10 shadow-xl">
			<div class="flex items-center gap-3">
				<span class="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300">
					<Swords class="h-6 w-6" />
				</span>
				<div>
					<span class="text-xs font-mono font-semibold uppercase tracking-wider text-rose-400/80">Koszary i dług</span>
					<h2 class="font-serif text-2xl font-bold text-rose-200 sm:text-3xl">{m.landing_hedgehog_sparta_title()}</h2>
				</div>
			</div>
			<ul class="mt-8 space-y-4 text-base text-zinc-300">
				<li class="flex items-start gap-3">
					<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-400"></span>
					<span>{m.landing_hedgehog_sparta_1()}</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-400"></span>
					<span>{m.landing_hedgehog_sparta_2()}</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-400"></span>
					<span>{m.landing_hedgehog_sparta_3()}</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-400"></span>
					<span>{m.landing_hedgehog_sparta_4()}</span>
				</li>
			</ul>
		</div>

		<!-- HEDGEHOG DOCTRINE -->
		<div class="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-zinc-900/70 to-zinc-950 p-6 sm:p-10 shadow-xl">
			<div class="flex items-center gap-3">
				<span class="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
					<Shield class="h-6 w-6" />
				</span>
				<div>
					<span class="text-xs font-mono font-semibold uppercase tracking-wider text-amber-400/80">Płodność i tarcza</span>
					<h2 class="font-serif text-2xl font-bold text-amber-300 sm:text-3xl">{m.landing_hedgehog_jeza_title()}</h2>
				</div>
			</div>
			<ul class="mt-8 space-y-4 text-base text-zinc-200">
				<li class="flex items-start gap-3">
					<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400"></span>
					<span>{m.landing_hedgehog_jeza_1()}</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400"></span>
					<span>{m.landing_hedgehog_jeza_2()}</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400"></span>
					<span>{m.landing_hedgehog_jeza_3()}</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400"></span>
					<span>{m.landing_hedgehog_jeza_4()}</span>
				</li>
			</ul>
		</div>
	</div>
</section>

<!-- SEVEN SPIKES ARCHITECTURE -->
<section class="border-y border-zinc-900 bg-zinc-900/30 py-16 sm:py-24">
	<div class="mx-auto max-w-7xl px-4 sm:px-6">
		<div class="max-w-3xl">
			<span class="text-xs font-semibold tracking-[0.25em] text-amber-400 uppercase">Canon 04 & 05</span>
			<h2 class="mt-3 font-serif text-3xl font-bold tracking-tight text-white sm:text-5xl">{m.hedgehog_7spikes_title()}</h2>
			<p class="mt-4 text-lg leading-relaxed text-zinc-300">{m.hedgehog_7spikes_lead()}</p>
		</div>

		<div class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each spikes as spike (spike.num)}
				{@const Icon = spike.icon}
				<div class="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 transition-all hover:border-amber-500/50 hover:bg-zinc-900/40">
					<div>
						<div class="flex items-center justify-between">
							<span class="flex h-11 w-11 items-center justify-center rounded-xl border {spike.highlight}">
								<Icon class="h-5 w-5" />
							</span>
							<span class="font-mono text-xs font-semibold text-zinc-500">{spike.num}</span>
						</div>
						<h3 class="mt-5 font-serif text-xl font-bold text-zinc-100 group-hover:text-amber-300 transition-colors">
							{spike.title}
						</h3>
						<p class="mt-3 text-sm leading-relaxed text-zinc-400">
							{spike.desc}
						</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- LEGAL FRAMEWORK: HAGUE V & OASIS OF PEACE -->
<section class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
	<div class="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-950 to-zinc-950 p-8 sm:p-12">
		<div class="flex items-center gap-3 text-amber-400">
			<Scale class="h-6 w-6" />
			<span class="text-xs font-mono font-semibold uppercase tracking-widest">V Konwencja Haska z 1907 r.</span>
		</div>
		<h2 class="mt-4 font-serif text-3xl font-bold text-white sm:text-4xl">
			Wieczysta Neutralność jako Nienaruszalna Oaza Pokoju
		</h2>
		<p class="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-300">
			Neutralność w doktrynie Przymierza Lemiesza to nie bezbronny pacyfizm, lecz status wzorowany na Szwajcarii: zbrojna suwerenność, w której terytorium Rzeczypospolitej nie może być wykorzystane do przemarszu obcych wojsk, zakładania obcych baz ani instalacji głębokiego uderzenia.
		</p>
		<div class="mt-8 flex flex-wrap gap-4">
			<a
				href="/repository"
				class="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
			>
				Przejdź do Repozytorium Kanonu <ArrowRight class="h-4 w-4" />
			</a>
			<a
				href="/shield"
				class="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/80 px-5 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-amber-500/50 hover:text-white"
			>
				Przetestuj argumenty w Tarczy <ArrowRight class="h-4 w-4" />
			</a>
		</div>
	</div>
</section>

<!-- EXPLORE OTHER PILLARS -->
<section class="border-t border-zinc-900 bg-zinc-950 px-4 py-16 sm:px-6 sm:py-20">
	<div class="mx-auto max-w-7xl">
		<p class="text-xs font-semibold tracking-[0.25em] text-zinc-500 uppercase">{m.nav_explore_next()}</p>
		<div class="mt-6 grid gap-6 sm:grid-cols-2">
			<a
				href="/za-i-przeciw"
				class="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 transition-all hover:border-amber-500/60 hover:bg-zinc-900/80"
			>
				<div>
					<span class="text-xs font-semibold text-amber-400 uppercase tracking-wider">1 Księga Samuela 8</span>
					<h3 class="mt-2 font-serif text-2xl font-bold text-white group-hover:text-amber-300 transition-colors">
						Za i Przeciw — Cena Korony
					</h3>
					<p class="mt-2 text-sm text-zinc-400 leading-relaxed">
						{m.landing_cost_intro()}
					</p>
				</div>
				<span class="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
					Czytaj dalej <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1" />
				</span>
			</a>

			<a
				href="/polskie-mocarstwo"
				class="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 transition-all hover:border-amber-500/60 hover:bg-zinc-900/80"
			>
				<div>
					<span class="text-xs font-semibold text-amber-400 uppercase tracking-wider">Geopolityka i Suwerenność</span>
					<h3 class="mt-2 font-serif text-2xl font-bold text-white group-hover:text-amber-300 transition-colors">
						Polskie Mocarstwo — Imadło Geopolityczne
					</h3>
					<p class="mt-2 text-sm text-zinc-400 leading-relaxed">
						{m.power_hero_lead()}
					</p>
				</div>
				<span class="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
					Czytaj dalej <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1" />
				</span>
			</a>
		</div>
	</div>
</section>
