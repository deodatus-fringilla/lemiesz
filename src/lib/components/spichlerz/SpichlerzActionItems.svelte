<script lang="ts">
	import { enhance } from '$app/forms';
	import CheckSquare from 'lucide-svelte/icons/check-square';
	import Plus from 'lucide-svelte/icons/plus';
	import { m } from '$lib/paraglide/messages.js';
	import type { RadarTask, TaskItem } from '$lib/server/spichlerz-tasks';
	import SpichlerzTaskRow from './SpichlerzTaskRow.svelte';
	import SpichlerzUndoToast from './SpichlerzUndoToast.svelte';
	import { UndoToast, createTaskOps } from './task-ops.svelte';
	import { today as clock } from './today.svelte';
	import { countTasks } from './task-groups';

	let { entryId, entryTitle = '', items }: { entryId: number; entryTitle?: string; items: TaskItem[] } = $props();

	const toast = new UndoToast();
	const ops = createTaskOps(toast);
	const tasks = $derived<RadarTask[]>(items.map((item) => ({ entryId, entryTitle, item })));
	const counts = $derived(countTasks(tasks));
</script>

<div class="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 space-y-3">
	<h4 class="flex items-center gap-2 text-xs font-semibold tracking-wider text-amber-400 uppercase">
		<CheckSquare class="h-3.5 w-3.5" />
		<span>{m.meetings_action_items()}</span>
		<span class="font-mono normal-case text-zinc-400">{m.task_count_summary(counts)}</span>
	</h4>

	{#if tasks.length > 0}
		<ul class="space-y-1.5">
			{#each tasks as t (t.item.id)}<SpichlerzTaskRow task={t} {ops} today={clock.value} />{/each}
		</ul>
	{:else}
		<p class="text-xs italic text-zinc-500">{m.meetings_no_items()}</p>
	{/if}

		<form
			method="POST"
			action="?/addTask"
			use:enhance={({ formElement }) => {
				return async ({ update }) => {
					await update();
					formElement.reset();
				};
			}}
			class="flex flex-wrap items-center gap-1.5 border-t border-zinc-800/80 pt-2.5 text-xs"
		>
			<input type="hidden" name="entryId" value={entryId} />
			<input
				name="task"
				required
				placeholder={m.meetings_task_placeholder()}
				class="min-w-[160px] flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-100 focus:border-amber-500/50 focus:outline-none"
			/>
			<input
				name="assignee"
				placeholder={m.meetings_quick_task_assignee()}
				class="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-amber-500/50 focus:outline-none"
			/>
			<input
				type="date"
				name="due_date"
				class="w-28 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-amber-500/50 focus:outline-none"
			/>
			<button
				type="submit"
				class="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
			>
				<Plus class="h-3.5 w-3.5" />
				{m.meetings_add_task()}
			</button>
		</form>
</div>

<SpichlerzUndoToast {toast} />
