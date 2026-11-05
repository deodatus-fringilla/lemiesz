<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { compressImage, MAX_BYTES } from './compress-image';

	/** Pick a photo, see it shrunk to ≤ 400 kB, describe it (author, licence, alt text), upload it as a draft image. */
	let { locale, onuploaded, file: given }: { locale: string; onuploaded: (id: number) => void; file?: File } = $props();

	let shrunk = $state<{ blob: Blob; width: number; height: number; url: string } | null>(null);
	let error = $state<string | null>(null);
	let busy = $state(false);
	let fields = $state({ title: '', artist: '', license: '', alt: '', caption: '' });

	const choose = (e: Event) => useFile((e.currentTarget as HTMLInputElement).files?.[0]);
	// An image pasted or dropped into the text starts the form with that file already chosen.
	onMount(() => void useFile(given));

	async function useFile(file: File | undefined) {
		error = null;
		if (!file) return;
		busy = true;
		try {
			const r = await compressImage(file);
			if (shrunk) URL.revokeObjectURL(shrunk.url);
			shrunk = { ...r, url: URL.createObjectURL(r.blob) };
			if (!fields.title) fields.title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
		} catch {
			error = m.img_too_big({ kb: MAX_BYTES / 1024 });
		} finally {
			busy = false;
		}
	}

	async function upload() {
		if (!shrunk) return;
		busy = true;
		const body = new FormData();
		body.append('file', shrunk.blob, shrunk.blob.type === 'image/webp' ? 'image.webp' : 'image.jpg');
		for (const [k, v] of Object.entries(fields)) body.append(k, v);
		body.append('locale', locale);
		try {
			const r = deserialize(await (await fetch('?/uploadImage', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } })).text());
			if (r.type === 'success') {
				await invalidateAll();
				onuploaded((r.data as { uploaded: number }).uploaded);
			} else error = r.type === 'failure' ? String((r.data as { error?: string })?.error) : m.task_error();
		} catch {
			error = m.task_error();
		} finally {
			busy = false;
		}
	}
	const input = 'w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none';
	const ready = $derived(!!shrunk && !!fields.title.trim() && !!fields.artist.trim() && !!fields.license.trim() && !!fields.alt.trim());
</script>

<div class="space-y-2 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-xs">
	<input type="file" accept="image/jpeg,image/png,image/webp" onchange={choose} class="block w-full text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-zinc-200" />
	{#if busy}<p class="text-zinc-400">{m.img_working()}</p>{/if}
	{#if shrunk}
		<div class="flex gap-3">
			<img src={shrunk.url} alt="" class="h-20 w-28 shrink-0 rounded object-cover" />
			<p class="text-zinc-400">{m.img_shrunk({ w: shrunk.width, h: shrunk.height, kb: Math.round(shrunk.blob.size / 1024) })}</p>
		</div>
		<input bind:value={fields.title} placeholder={m.img_title()} class={input} />
		<div class="grid gap-2 sm:grid-cols-2">
			<input bind:value={fields.artist} placeholder={m.img_artist()} class={input} />
			<input bind:value={fields.license} placeholder={m.img_license()} class={input} />
		</div>
		<textarea bind:value={fields.alt} lang={locale} rows="2" placeholder={m.img_alt()} class={input}></textarea>
		<input bind:value={fields.caption} lang={locale} placeholder={m.img_caption_default()} class={input} />
		<button type="button" disabled={!ready || busy} onclick={upload} class="rounded bg-amber-500 px-3 py-1.5 font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40">{m.img_upload()}</button>
	{/if}
	{#if error}<p role="alert" class="text-rose-300">{error}</p>{/if}
</div>
