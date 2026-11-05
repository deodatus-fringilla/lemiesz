<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { feedPath, followPath, journalHome } from '$lib/journal-paths';
	import JournalHead from '$lib/components/journal/public/JournalHead.svelte';
	import JournalMasthead from '$lib/components/journal/public/JournalMasthead.svelte';
	import PublicFeedCopy from '$lib/components/journal/public/PublicFeedCopy.svelte';

	let { data } = $props();
	const o = $derived({ locale: data.lang });
	const steps = $derived([m.pub_follow_step1({}, o), m.pub_follow_step2({}, o), m.pub_follow_step3({}, o)]);
</script>

<JournalHead title={`${m.pub_follow_title({}, o)} · Lemiesz.`} description={m.pub_follow_intro({}, o)} url={`${data.origin}${followPath(data.lang)}`} lang={data.lang} feed={feedPath(data.lang)} />

<div class="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
	<JournalMasthead lang={data.lang} current="follow" other={data.lang === 'en' ? { lang: 'pl', href: followPath('pl') } : { lang: 'en', href: followPath('en') }} />

	<section class="max-w-2xl space-y-6">
		<header class="space-y-2">
			<h1 class="font-serif text-3xl font-bold text-zinc-50">{m.pub_follow_title({}, o)}</h1>
			<p class="text-lg text-zinc-300">{m.pub_follow_intro({}, o)}</p>
		</header>

		<ol class="list-decimal space-y-2 pl-5 text-zinc-300 marker:font-semibold marker:text-amber-300">
			{#each steps as s (s)}<li>{s}</li>{/each}
		</ol>

		<div class="space-y-2">
			<p class="text-sm font-semibold tracking-wider text-zinc-400 uppercase">{m.pub_follow_feed_label({}, o)}</p>
			<PublicFeedCopy url={data.feedUrl} lang={data.lang} />
			<a href={feedPath(data.lang)} data-sveltekit-reload class="inline-block text-sm text-amber-300 hover:underline">{m.pub_follow_open({}, o)}</a>
		</div>

		<p class="text-sm text-zinc-500">{m.pub_follow_note({}, o)}</p>
		<a href={journalHome(data.lang)} class="inline-block text-amber-300 hover:underline">{m.pub_back_home({}, o)}</a>
	</section>
</div>
