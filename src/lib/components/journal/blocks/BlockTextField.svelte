<script lang="ts">
	import { Editor, type Citation, type UploadedImage } from '$lib/editor';
	import { m } from '$lib/paraglide/messages.js';
	import type { CitableSource } from '$lib/server/journal-citations';
	import { editorContext } from './editor-context';
	import { editorLabels } from './editor-labels';
	import ImagePicker from './ImagePicker.svelte';
	import PickModal from './PickModal.svelte';
	import SourcePicker from './SourcePicker.svelte';

	/**
	 * A text or highlight block: the visual article editor (src/lib/editor, a copy of the standalone Editor). What it
	 * stores is the same Markdown as before, with [[src:ID]] notes and images as lines `![](address "caption"){.left}`
	 * that point into the image library. Images and sources are chosen in the platform's own pickers.
	 */
	let { value = $bindable(), kind, sources, locale }: { value: string; kind: 'text' | 'callout'; sources: CitableSource[]; locale: string } = $props();
	const ctx = editorContext();
	const labels = $derived(editorLabels(sources));

	/** The picker window that is open, and the function that hands its answer back to the editor. */
	type Open = { what: 'image'; file?: File; answer: (r: UploadedImage | null) => void } | { what: 'source'; answer: (r: Citation | null) => void };
	let open = $state<Open | null>(null);
	const askImage = (file?: File) => new Promise<UploadedImage | null>((answer) => (open = { what: 'image', file, answer }));
	const askSource = () => new Promise<Citation | null>((answer) => (open = { what: 'source', answer }));

	/** Closing the window without choosing answers "nothing" (once). */
	function close() {
		const o = open;
		open = null;
		(o?.answer as ((r: null) => void) | undefined)?.(null);
	}
	function choose(r: UploadedImage | Citation) {
		const o = open;
		open = null;
		(o?.answer as ((r: UploadedImage | Citation) => void) | undefined)?.(r);
	}
	function pickedImage(id: number) {
		const img = ctx.images.find((i) => i.id === id);
		if (!img) return close();
		// The description belongs to the library image; the caption stays empty so the library's own is used.
		choose({ src: img.src, alt: ((ctx.locale === 'en' ? img.alt_en : img.alt_pl) ?? '').trim(), caption: '' });
	}
</script>

<div class="journal-editor">
	<Editor
		bind:value
		{labels}
		lang={locale}
		placeholder={kind === 'callout' ? m.blocks_placeholder_callout() : m.blocks_placeholder_text()}
		onPickImage={askImage}
		onPickCitation={askSource}
		altEditable={false}
		placements={['center', 'left', 'right']}
		allowImage={(src) => src.startsWith('/images/')}
	/>
</div>

{#if open?.what === 'image'}
	<PickModal title={m.ed_pick_image()} onclose={close}><ImagePicker file={open.file} onpick={pickedImage} /></PickModal>
{:else if open?.what === 'source'}
	<PickModal title={m.ed_pick_source()} onclose={close}><SourcePicker {sources} {locale} onpick={(id) => choose({ kind: 'src', id })} /></PickModal>
{/if}

<style>
	/* The platform's dark, amber look for the editor (it takes its colours from --ed-* variables). */
	.journal-editor {
		--ed-bg: rgb(9 9 11);
		--ed-fg: rgb(244 244 245);
		--ed-muted: rgb(161 161 170);
		--ed-border: rgb(39 39 42);
		--ed-hover: rgb(39 39 42);
		--ed-toolbar-bg: rgb(24 24 27);
		--ed-accent: rgb(251 191 36);
		--ed-accent-soft: rgb(251 191 36 / 0.15);
		--ed-accent-fg: rgb(252 211 77);
		--ed-on-accent: rgb(9 9 11);
		--ed-danger: rgb(253 164 175);
		--ed-radius: 0.5rem;
		--ed-ui-font: ui-sans-serif, system-ui, sans-serif;
		--ed-font: ui-sans-serif, system-ui, sans-serif;
		--ed-font-size: 15px;
		--ed-line-height: 1.75;
		--ed-color-scheme: dark;
		--mde-min-height: 6.5rem;
	}
</style>
