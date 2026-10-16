<script lang="ts">
	import { ArrowRight, ChevronDown, CookingPot, Coins, Grape, Hammer, LayoutDashboard, Link, LogIn, Swords, Users, VolumeX } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';
	import {
		SAMUEL8_REF,
		SAMUEL8_TRANSLATION,
		consequences,
		lordAnswers,
		request,
		samuelPrays,
		samuelTells,
		type ConsequenceKey
	} from '$lib/content/samuel8';

	let { data } = $props();

	const icons: Record<ConsequenceKey, typeof Swords> = {
		army: Swords,
		labour: Hammer,
		daughters: CookingPot,
		land: Grape,
		tithe_harvest: Coins,
		servants: Users,
		slavery: Link,
		silence: VolumeX
	};
	const titles: Record<ConsequenceKey, () => string> = {
		army: m.landing_c_army,
		labour: m.landing_c_labour,
		daughters: m.landing_c_daughters,
		land: m.landing_c_land,
		tithe_harvest: m.landing_c_tithe_harvest,
		servants: m.landing_c_servants,
		slavery: m.landing_c_slavery,
		silence: m.landing_c_silence
	};
</script>

<svelte:head>
	<meta name="description" content={m.landing_lead()} />
	<meta property="og:image" content="/images/two_crowns_hero.jpg" />
</svelte:head>

<!-- HERO -->
<section class="relative isolate flex min-h-[92vh] items-end overflow-hidden">
	<img
		src="/images/two_crowns_hero.jpg"
		alt={m.landing_hero_alt()}
		class="absolute inset-0 -z-20 h-full w-full object-cover object-center"
		fetchpriority="high"
	/>
	<div class="absolute inset-0 -z-10 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/10"></div>
	<div class="absolute inset-0 -z-10 bg-gradient-to-r from-zinc-950/70 via-transparent to-transparent"></div>

	<div class="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
		<p class="text-xs font-semibold tracking-[0.25em] text-amber-400 uppercase">{m.landing_eyebrow()}</p>
		<h1 class="mt-4 font-serif text-5xl leading-[1.05] font-bold tracking-tight text-zinc-50 sm:text-7xl">
			{m.landing_title_a()}<br /><span class="text-amber-400">{m.landing_title_b()}</span>
		</h1>
		<p class="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300">{m.landing_lead()}</p>

		<div class="mt-8 flex flex-wrap items-center gap-3">
			<a href="#warning" class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
				{m.landing_cta_read()} <ChevronDown class="h-4 w-4" />
			</a>
			{#if data.user}
				<a href="/dashboard" class="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-950/50 px-5 py-2.5 text-sm font-semibold text-zinc-100 backdrop-blur hover:border-amber-500/60">
					<LayoutDashboard class="h-4 w-4" /> {m.landing_cta_dashboard()}
				</a>
			{:else}
				<a href="/login" class="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-950/50 px-5 py-2.5 text-sm font-semibold text-zinc-100 backdrop-blur hover:border-amber-500/60">
					<LogIn class="h-4 w-4" /> {m.landing_cta_signin()}
				</a>
			{/if}
		</div>
	</div>
</section>

<!-- THE REQUEST & THE ANSWER (vv. 4–10) -->
<section id="warning" class="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
	<p class="text-center text-xs font-semibold tracking-[0.25em] text-zinc-500 uppercase">{SAMUEL8_REF}</p>
	<div class="mt-10 grid gap-8 lg:grid-cols-2">
		<article class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
			<h2 class="text-sm font-semibold tracking-widest text-zinc-400 uppercase">{m.landing_request_title()}</h2>
			<p class="mt-4 font-serif text-xl leading-relaxed text-zinc-200">
				{#each request as v (v.n)}<sup class="mr-1 font-sans text-xs text-amber-500/80">{v.n}</sup>{v.text}{' '}{/each}
			</p>
		</article>

		<article class="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-900/60 to-zinc-950 p-6 sm:p-8">
			<h2 class="text-sm font-semibold tracking-widest text-amber-300 uppercase">{m.landing_answer_title()}</h2>
			<p class="mt-4 leading-relaxed text-zinc-300">
				{#each samuelPrays as v (v.n)}<sup class="mr-1 text-xs text-amber-500/80">{v.n}</sup>{v.text}{' '}{/each}
			</p>
			<blockquote class="mt-4 border-l-2 border-amber-500/60 pl-4 font-serif text-xl leading-relaxed text-zinc-100">
				{#each lordAnswers as v, i (i)}{#if i > 0}<sup class="mr-1 font-sans text-xs text-amber-500/80">{v.n}</sup>{/if}{v.text}{' '}{/each}
			</blockquote>
			<p class="mt-4 leading-relaxed text-zinc-300">
				<sup class="mr-1 text-xs text-amber-500/80">{samuelTells.n}</sup>{samuelTells.text}
			</p>
		</article>
	</div>
</section>

<!-- THE COST OF THE CROWN (vv. 11–18) -->
<section class="border-y border-zinc-900 bg-zinc-900/30">
	<div class="mx-auto max-w-7xl px-4 py-20 sm:px-6">
		<div class="max-w-3xl">
			<p class="text-xs font-semibold tracking-[0.25em] text-rose-400/90 uppercase">{m.landing_cost_eyebrow()}</p>
			<h2 class="mt-3 font-serif text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">{m.landing_cost_title()}</h2>
			<p class="mt-4 text-lg leading-relaxed text-zinc-400">{m.landing_cost_intro()}</p>
		</div>

		<ol class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each consequences as c, i (c.key)}
				{@const Icon = icons[c.key]}
				<li
					class="group relative flex flex-col rounded-xl border p-5 transition-colors {c.climax
						? 'border-rose-500/40 bg-rose-950/20 hover:border-rose-400/70 lg:col-span-2'
						: 'border-zinc-800 bg-zinc-950/60 hover:border-amber-500/40'}"
				>
					<div class="flex items-center justify-between">
						<span class="flex h-10 w-10 items-center justify-center rounded-lg border {c.climax ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-400'}">
							<Icon class="h-5 w-5" />
						</span>
						<span class="font-mono text-xs text-zinc-500">{String(i + 1).padStart(2, '0')} · {c.ref}</span>
					</div>
					<h3 class="mt-4 text-lg font-semibold {c.climax ? 'text-rose-200' : 'text-zinc-100'}">{titles[c.key]()}</h3>
					<p class="mt-2 font-serif leading-relaxed {c.climax ? 'text-xl text-zinc-200' : 'text-zinc-400'}">
						{#each c.verses as v (v.n)}<sup class="mr-1 font-sans text-[10px] text-zinc-500">{v.n}</sup>{v.text}{' '}{/each}
					</p>
				</li>
			{/each}
		</ol>

		<p class="mt-12 text-center font-serif text-sm tracking-[0.2em] text-zinc-500 uppercase sm:text-base">{m.landing_tally()}</p>
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
			href={data.user ? '/dashboard' : '/login'}
			class="mt-10 inline-flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-5 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/20"
		>
			{data.user ? m.landing_cta_dashboard() : m.landing_cta_signin()} <ArrowRight class="h-4 w-4" />
		</a>
		<p class="mt-12 text-xs text-zinc-600">{m.landing_translation_note({ translation: `${SAMUEL8_REF}, ${SAMUEL8_TRANSLATION}` })}</p>
	</div>
</section>
