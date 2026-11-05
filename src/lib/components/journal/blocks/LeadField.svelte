<script lang="ts">
	import { Editor } from '$lib/editor';
	import { m } from '$lib/paraglide/messages.js';
	import { editorLabels } from './editor-labels';

	/**
	 * The lead (the abstract readers open from the list and see under the title) in the same visual editor as the text.
	 * It has no images and no source notes: those buttons stay hidden because the editor is given nothing to fetch them
	 * with. What is stored is Markdown, posted as `lead`.
	 */
	let { value, locale }: { value: string; locale: string } = $props();
	// svelte-ignore state_referenced_locally
	let md = $state(value);
	const labels = editorLabels([]);
</script>

<input type="hidden" name="lead" value={md} />
<div class="lead-editor">
	<Editor bind:value={md} {labels} lang={locale} placeholder={m.journal_field_lead()} />
</div>

<style>
	/* The platform's dark, amber look (the editor takes its colours from --ed-* variables); a shorter field than a text block. */
	.lead-editor {
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
		--ed-line-height: 1.7;
		--ed-color-scheme: dark;
		--mde-min-height: 4.5rem;
	}
</style>
