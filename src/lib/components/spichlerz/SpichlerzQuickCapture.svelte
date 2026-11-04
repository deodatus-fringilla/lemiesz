<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from 'lucide-svelte/icons/plus';
	import CheckSquare from 'lucide-svelte/icons/check-square';
	import FileText from 'lucide-svelte/icons/file-text';
	import { m } from '$lib/paraglide/messages.js';

	let captureMode = $state<'task' | 'note'>('task');
	// Tells the user where a captured item went (tasks land in the Backlog note).
	let notice = $state<string | null>(null);
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	function announce(text: string) {
		notice = text;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = null), 5000);
	}
</script>

<form
	method="POST"
	action="?/quickCapture"
	use:enhance={({ formElement }) => {
		return async ({ result, update }) => {
			await update();
			formElement.reset();
			if (result.type === 'success') {
				const d = result.data as { mode?: string; entryTitle?: string } | undefined;
				announce(d?.mode === 'note' ? m.task_captured_note() : m.task_captured_task({ title: d?.entryTitle ?? '' }));
			}
		};
	}}
	class="flex flex-col gap-2.5 rounded-xl border border-amber-500/25 bg-zinc-900/70 p-3 sm:flex-row sm:items-center"
>
	<input type="hidden" name="mode" value={captureMode} />

	<!-- Mode Switcher: Task vs Quick Note -->
	<div class="inline-flex shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-xs">
		<button
			type="button"
			onclick={() => (captureMode = 'task')}
			class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition {captureMode === 'task'
				? 'bg-amber-500/20 text-amber-300'
				: 'text-zinc-400 hover:text-zinc-200'}"
		>
			<CheckSquare class="h-3.5 w-3.5" />
			{m.spichlerz_quick_task_btn()}
		</button>
		<button
			type="button"
			onclick={() => (captureMode = 'note')}
			class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition {captureMode === 'note'
				? 'bg-amber-500/20 text-amber-300'
				: 'text-zinc-400 hover:text-zinc-200'}"
		>
			<FileText class="h-3.5 w-3.5" />
			{m.spichlerz_quick_note_btn()}
		</button>
	</div>

	<!-- Text Input -->
	<input
		name="text"
		required
		placeholder={m.spichlerz_quick_placeholder()}
		class="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
	/>

	{#if captureMode === 'task'}
		<input
			name="assignee"
			placeholder={m.meetings_quick_task_assignee()}
			class="w-full sm:w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
		/>
		<input
			type="date"
			name="due_date"
			title={m.meetings_quick_task_due()}
			class="w-full sm:w-32 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-amber-500/50 focus:outline-none"
		/>
	{/if}

	<button
		type="submit"
		class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400"
	>
		<Plus class="h-3.5 w-3.5" />
		{captureMode === 'task' ? m.meetings_quick_task_add() : m.spichlerz_new_btn()}
	</button>
</form>

{#if notice}
	<p role="status" class="-mt-2 px-1 text-xs text-emerald-400">{notice}</p>
{/if}
