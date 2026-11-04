<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import { journalHome, langOf } from '$lib/journal-paths';
	import JournalMasthead from '$lib/components/journal/public/JournalMasthead.svelte';

	/** A missing or withdrawn article (or any journal error) stays inside the journal, with a way back. */
	const lang = $derived(langOf(page.params.lang));
	const o = $derived({ locale: lang });
	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{notFound ? m.pub_not_found_title({}, o) : m.pub_error_title({}, o)} · Lemiesz.</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
	<JournalMasthead {lang} current="articles" />
	<section class="max-w-xl space-y-3">
		<h1 class="font-serif text-2xl font-bold text-zinc-50">{notFound ? m.pub_not_found_title({}, o) : m.pub_error_title({}, o)}</h1>
		<p class="text-zinc-400">{notFound ? m.pub_not_found_text({}, o) : m.pub_error_text({}, o)}</p>
		<a href={journalHome(lang)} class="inline-block text-amber-300 hover:underline">{m.pub_back_home({}, o)}</a>
	</section>
</div>
