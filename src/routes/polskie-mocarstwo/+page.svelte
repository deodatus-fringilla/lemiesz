<script lang="ts">
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import ShieldAlert from 'lucide-svelte/icons/shield-alert';
	import Cpu from 'lucide-svelte/icons/cpu';
	import Landmark from 'lucide-svelte/icons/landmark';
	import Scale from 'lucide-svelte/icons/scale';
	import Compass from 'lucide-svelte/icons/compass';
	import Sprout from 'lucide-svelte/icons/sprout';
	import Wheat from 'lucide-svelte/icons/wheat';
	import Users from 'lucide-svelte/icons/users';
	import { m } from '$lib/paraglide/messages.js';
	import HeroCarousel from '$lib/components/HeroCarousel.svelte';

	const oxymorons = [
		{
			num: '01',
			title: m.power_oxymoron_1_title(),
			body: m.power_oxymoron_1_body(),
			icon: Cpu,
			color: 'border-rose-500/30 bg-rose-500/10 text-rose-300'
		},
		{
			num: '02',
			title: m.power_oxymoron_2_title(),
			body: m.power_oxymoron_2_body(),
			icon: Landmark,
			color: 'border-amber-500/30 bg-amber-500/10 text-amber-300'
		},
		{
			num: '03',
			title: m.power_oxymoron_3_title(),
			body: m.power_oxymoron_3_body(),
			icon: Scale,
			color: 'border-crimson-500/30 bg-crimson-500/10 text-crimson-300'
		},
		{
			num: '04',
			title: m.power_oxymoron_4_title(),
			body: m.power_oxymoron_4_body(),
			icon: Compass,
			color: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
		}
	];
</script>

<svelte:head>
	<title>{m.nav_polish_power()} — {m.power_hero_eyebrow()} | Przymierze Lemiesza</title>
	<meta name="description" content={m.power_hero_lead()} />
	<meta property="og:image" content="/images/imadlo_geopolityczne_hero.jpg" />
</svelte:head>

<!-- HERO CAROUSEL: POLISH POWER -->
<HeroCarousel currentId="polskie_mocarstwo" scrollTarget="#deconstruction" />

<!-- FOUR OXYMORONS OF "INDEPENDENCE" -->
<section id="deconstruction" class="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
	<div class="max-w-3xl mb-12 sm:mb-16">
		<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-amber-300 uppercase">
			<Compass class="h-3.5 w-3.5" /> {m.power_hero_eyebrow()}
		</span>
		<h1 class="mt-4 font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
			{m.power_hero_title()}
		</h1>
		<p class="mt-6 text-lg leading-relaxed text-zinc-300 sm:text-xl">
			{m.power_hero_lead()}
		</p>
	</div>

	<div class="max-w-3xl">
		<span class="text-xs font-semibold tracking-[0.25em] text-rose-400 uppercase">Canon 06 · Dekonstrukcja</span>
		<h2 class="mt-3 font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl">
			{m.power_deconstruction_title()}
		</h2>
		<p class="mt-4 text-lg leading-relaxed text-zinc-300">
			{m.power_deconstruction_lead()}
		</p>
	</div>

	<div class="mt-12 grid gap-6 sm:grid-cols-2">
		{#each oxymorons as item (item.num)}
			{@const Icon = item.icon}
			<article class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 transition-colors hover:border-zinc-700">
				<div class="flex items-center justify-between">
					<span class="flex h-12 w-12 items-center justify-center rounded-xl border {item.color}">
						<Icon class="h-6 w-6" />
					</span>
					<span class="font-mono text-xs font-semibold text-zinc-500">{item.num}</span>
				</div>
				<h3 class="mt-6 font-serif text-2xl font-bold text-zinc-100">
					{item.title}
				</h3>
				<p class="mt-3 text-base leading-relaxed text-zinc-400">
					{item.body}
				</p>
			</article>
		{/each}
	</div>
</section>

<!-- HISTORICAL LESSON: 1939 SANACJA & KUTY BRIDGE -->
<section class="border-y border-zinc-900 bg-zinc-900/30 py-16 sm:py-24">
	<div class="mx-auto max-w-7xl px-4 sm:px-6">
		<div class="rounded-3xl border border-rose-500/30 bg-gradient-to-br from-rose-950/20 via-zinc-950 to-zinc-950 p-8 sm:p-12">
			<div class="flex items-center gap-3 text-rose-400">
				<ShieldAlert class="h-6 w-6" />
				<span class="text-xs font-mono font-semibold uppercase tracking-widest">Rachunek Królewski · Łk 14, 31–32</span>
			</div>
			<h2 class="mt-4 font-serif text-3xl font-bold text-white sm:text-4xl">
				{m.power_sanacja_title()}
			</h2>
			<p class="mt-5 max-w-4xl text-lg leading-relaxed text-zinc-300">
				{m.power_sanacja_body()}
			</p>
			<blockquote class="mt-8 border-l-2 border-rose-500/60 pl-6 font-serif text-xl italic leading-relaxed text-zinc-200">
				„Najemnik zaś i ten, kto nie jest pasterzem, którego owce nie są własnością, widząc nadchodzącego wilka, opuszcza owce i ucieka, a wilk je porywa i rozprasza; dlatego że jest najemnikiem i nie zależy mu na owcach.”
				<span class="mt-2 block font-sans text-xs tracking-wider text-rose-400 not-italic uppercase">Ewangelia według św. Jana 10, 12–13</span>
			</blockquote>
		</div>
	</div>
</section>

<!-- AUTHENTIC POWER: FERTILITY & CAPITAL -->
<section class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
	<div class="grid gap-12 lg:grid-cols-2 lg:items-center">
		<div>
			<span class="text-xs font-semibold tracking-[0.25em] text-amber-400 uppercase">Prawdziwa Siła Narodu</span>
			<h2 class="mt-3 font-serif text-3xl font-bold tracking-tight text-white sm:text-5xl">
				{m.power_real_title()}
			</h2>
			<p class="mt-6 text-lg leading-relaxed text-zinc-300">
				{m.power_real_body()}
			</p>
			<div class="mt-8 space-y-4">
				<div class="flex items-start gap-3">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
						<Wheat class="h-4 w-4" />
					</span>
					<div>
						<h4 class="font-semibold text-zinc-100">Suwerenność Żywnościowa i Ziemia</h4>
						<p class="text-sm text-zinc-400">Polska ziemia rodząca chleb dla narodu, a nie oddawana pod bazy obcych mocarstw.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
						<Users class="h-4 w-4" />
					</span>
					<div>
						<h4 class="font-semibold text-zinc-100">Demografia i Bezpieczeństwo Rodziny</h4>
						<p class="text-sm text-zinc-400">Ochrona polskiej krwi — synowie pracujący na własnym łanie i we własnych warsztatach zamiast ginąć na obcych frontach.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
						<Sprout class="h-4 w-4" />
					</span>
					<div>
						<h4 class="font-semibold text-zinc-100">Kapitał Własny Zamiast Lichwy</h4>
						<p class="text-sm text-zinc-400">Inwestycje w fabryki maszyn, retencję wody i infrastrukturę cywilną, które mnożą bogactwo pokoleń.</p>
					</div>
				</div>
			</div>
		</div>

		<div class="rounded-3xl border border-zinc-800 bg-zinc-900/30 p-8 sm:p-10">
			<h3 class="font-serif text-2xl font-bold text-amber-300">
				Położenie Geopolityczne jako Szansa, Nie Przekleństwo
			</h3>
			<p class="mt-4 text-base leading-relaxed text-zinc-300">
				Polska leżąca na skrzyżowaniu szlaków handlowych Eurazji ma unikalną szansę stać się nienaruszalnym węzłem logistycznym, dyplomatycznym i handlowym Europy Środkowej — pod warunkiem, że nie pozwoli uczynić ze swojego terytorium tarczy strzeleckiej i zderzaka atomowego dla mocarstw morskich.
			</p>
			<div class="mt-8">
				<a
					href="/shield"
					class="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
				>
					Dyskutuj z Tarczą Doktryny <ArrowRight class="h-4 w-4" />
				</a>
			</div>
		</div>
	</div>
</section>

<!-- EXPLORE OTHER PILLARS -->
<section class="border-t border-zinc-900 bg-zinc-950 px-4 py-16 sm:px-6 sm:py-20">
	<div class="mx-auto max-w-7xl">
		<p class="text-xs font-semibold tracking-[0.25em] text-zinc-500 uppercase">{m.nav_explore_next()}</p>
		<div class="mt-6 grid gap-6 sm:grid-cols-2">
			<a
				href="/neutralna-polska"
				class="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 transition-all hover:border-amber-500/60 hover:bg-zinc-900/80"
			>
				<div>
					<span class="text-xs font-semibold text-amber-400 uppercase tracking-wider">Architektura Bezpieczeństwa</span>
					<h3 class="mt-2 font-serif text-2xl font-bold text-white group-hover:text-amber-300 transition-colors">
						Neutralna Polska — Doktryna Jeża
					</h3>
					<p class="mt-2 text-sm text-zinc-400 leading-relaxed">
						{m.landing_hedgehog_lead()}
					</p>
				</div>
				<span class="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
					Czytaj dalej <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1" />
				</span>
			</a>

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
		</div>
	</div>
</section>
