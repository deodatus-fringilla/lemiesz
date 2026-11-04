<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { m } from '$lib/paraglide/messages.js';
	import type { ImageSize } from '$lib/journal-blocks';
	import ReviewBadge from '../../ReviewBadge.svelte';
	import { editorContext } from './editor-context';
	import ImagePicker from './ImagePicker.svelte';

	/** An image block: the picture, its size and caption; fixes for what keeps it from readers (approval, alt text). */
	let { imageId = $bindable(), size = $bindable(), caption = $bindable() }: { imageId: number; size: ImageSize; caption?: string } = $props();
	const ctx = editorContext();
	const img = $derived(ctx.images.find((i) => i.id === imageId));
	const alt = $derived(img ? ((ctx.locale === 'en' ? img.alt_en : img.alt_pl) ?? '') : '');
	let changing = $state(false);
	let altDraft = $state('');
	let licenseDraft = $state('');
	let error = $state<string | null>(null);

	async function act(action: 'imageMeta' | 'imageStatus', fields: Record<string, string>) {
		const body = new FormData();
		body.append('imageId', String(imageId));
		body.append('locale', ctx.locale);
		for (const [k, v] of Object.entries(fields)) body.append(k, v);
		const r = deserialize(await (await fetch(`?/${action}`, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } })).text());
		error = r.type === 'success' ? null : String((r as { data?: { error?: string } }).data?.error ?? m.task_error());
		await invalidateAll();
	}
	const input = 'rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none';
</script>

{#if img && !changing}
	<div class="space-y-2">
		<div class="flex gap-3">
			<img src={img.src} alt={alt} class="h-24 w-36 shrink-0 rounded bg-zinc-950 object-cover" />
			<div class="min-w-0 space-y-1 text-xs">
				<p class="font-medium text-zinc-200">{img.title}</p>
				<p class="text-zinc-400">{img.artist}{img.license ? ` · ${img.license}` : ''}</p>
				<ReviewBadge state={img.status} />
				<button type="button" onclick={() => (changing = true)} class="block text-amber-300 hover:underline">{m.img_change()}</button>
			</div>
		</div>
		{#if !alt}
			<div class="space-y-1.5 rounded border border-rose-500/30 bg-rose-500/5 p-2 text-xs">
				<p class="text-rose-300">{m.img_needs_alt({ lang: ctx.locale.toUpperCase() })}</p>
				<textarea bind:value={altDraft} lang={ctx.locale} rows="2" placeholder={m.img_alt()} class="{input} w-full"></textarea>
				<input bind:value={licenseDraft} placeholder={img.license ?? m.img_license()} class="{input} w-full" />
				<button type="button" disabled={!altDraft.trim()} onclick={() => act('imageMeta', { alt: altDraft, license: licenseDraft || img.license || '' })} class="rounded border border-zinc-600 px-2.5 py-1 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40">{m.journal_save()}</button>
			</div>
		{:else if img.status !== 'human_approved'}
			<div class="flex flex-wrap items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
				<span class="text-amber-200">{m.img_needs_approval()}</span>
				<button type="button" onclick={() => act('imageStatus', { to: 'human_approved' })} class="rounded border border-emerald-500/40 px-2.5 py-1 text-emerald-300 hover:bg-emerald-500/10">{m.img_approve()}</button>
			</div>
		{/if}
		<div class="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
			<select bind:value={size} aria-label={m.img_size()} class={input}>
				<option value="column">{m.img_size_column()}</option>
				<option value="wide">{m.img_size_wide()}</option>
				<option value="full">{m.img_size_full()}</option>
			</select>
			<input bind:value={caption} lang={ctx.locale} placeholder={(ctx.locale === 'en' ? img.caption_en : img.caption_pl) || m.img_caption()} class={input} />
		</div>
		{#if error}<p role="alert" class="text-xs text-rose-300">{error}</p>{/if}
	</div>
{:else}
	<ImagePicker onpick={(id) => { imageId = id; changing = false; }} />
{/if}
