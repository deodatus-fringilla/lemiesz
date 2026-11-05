<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages.js';
	import type { ContentIssue } from '$lib/server/journal-images';

	/**
	 * What keeps the saved version's images and media from readers. An image that only needs approving, or a description
	 * in this language, can be fixed right here, so nobody has to leave the article to finish it.
	 */
	let { problems, locale }: { problems: ContentIssue[]; locale: string } = $props();

	const text = (p: ContentIssue) => {
		const what = p.kind === 'image' ? m.issue_image({ title: p.title ?? `#${p.id}` }) : m.issue_media({ title: p.title ?? `#${p.id}` });
		const why = p.reason === 'missing' ? m.issue_missing() : p.reason === 'not_approved' ? m.issue_not_approved() : m.issue_no_alt({ lang: locale.toUpperCase() });
		return `${what}: ${why}`;
	};
	const input = 'w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none';
</script>

<section class="space-y-1.5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
	<h3 class="font-semibold tracking-wider text-rose-300 uppercase">{m.journal_content_problems()}</h3>
	<ul class="list-disc space-y-2 pl-4 text-rose-200">
		{#each problems as p (`${p.kind}${p.id}${p.title}${p.reason}`)}
			<li>
				{text(p)}
				{#if p.kind === 'image' && p.reason === 'not_approved'}
					<form method="POST" action="?/imageStatus" use:enhance class="mt-1">
						<input type="hidden" name="imageId" value={p.id} />
						<input type="hidden" name="to" value="human_approved" />
						<button class="rounded border border-emerald-500/40 px-2.5 py-1 text-emerald-300 hover:bg-emerald-500/10">{m.img_approve()}</button>
					</form>
				{:else if p.kind === 'image' && p.reason === 'no_alt'}
					<form method="POST" action="?/imageMeta" use:enhance class="mt-1 space-y-1.5">
						<input type="hidden" name="imageId" value={p.id} />
						<input type="hidden" name="locale" value={locale} />
						<textarea name="alt" lang={locale} rows="2" required placeholder={m.img_alt()} class={input}></textarea>
						<button class="rounded border border-zinc-600 px-2.5 py-1 text-zinc-200 hover:bg-zinc-800">{m.journal_save()}</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
</section>
