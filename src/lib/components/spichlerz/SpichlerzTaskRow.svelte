<script lang="ts">
	import CheckSquare from 'lucide-svelte/icons/check-square';
	import Square from 'lucide-svelte/icons/square';
	import Pencil from 'lucide-svelte/icons/pencil';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import { m } from '$lib/paraglide/messages.js';
	import type { RadarTask } from '$lib/server/spichlerz-tasks';
	import type { TaskOps } from './task-ops.svelte';
	import { dueGroupOf } from './task-groups';

	let {
		task,
		ops,
		today,
		onselectentry
	}: { task: RadarTask; ops: TaskOps; today: string; onselectentry?: (entryId: number) => void } = $props();

	const item = $derived(task.item);
	const done = $derived(item.status === 'done');
	const overdue = $derived(!done && dueGroupOf(task, today) === 'overdue');

	let editing = $state(false);
	let draft = $state({ task: '', assignee: '', due_date: '' });
	const input = 'rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-amber-500/50 focus:outline-none';

	function startEdit() {
		draft = { task: item.task, assignee: item.assignee ?? '', due_date: item.due_date ?? '' };
		editing = true;
	}
	async function save() {
		if (draft.task.trim() && (await ops.edit(task, draft))) editing = false;
	}
</script>

<li class="group rounded-lg border border-zinc-800/70 bg-zinc-900/70 px-3 py-2 text-xs">
	{#if editing}
		<form class="flex flex-wrap items-center gap-1.5" onsubmit={(e) => { e.preventDefault(); save(); }}>
			<input bind:value={draft.task} required aria-label={m.meetings_task_placeholder()} class="{input} min-w-[160px] flex-1" />
			<input bind:value={draft.assignee} placeholder={m.meetings_quick_task_assignee()} class="{input} w-24" />
			<input type="date" bind:value={draft.due_date} class="{input} w-32" />
			<button type="submit" class="rounded-lg bg-amber-500 px-2.5 py-1 font-semibold text-zinc-950 hover:bg-amber-400">{m.task_save()}</button>
			<button type="button" onclick={() => (editing = false)} class="rounded-lg border border-zinc-700 px-2.5 py-1 text-zinc-300 hover:bg-zinc-800">{m.task_cancel()}</button>
		</form>
	{:else}
		<div class="flex items-start gap-2.5">
			<button
				type="button"
				onclick={() => ops.setDone(task, !done)}
				aria-label={done ? m.task_toast_reopened() : m.task_toast_done()}
				class="mt-0.5 shrink-0 transition {done ? 'text-emerald-400 hover:text-zinc-400' : 'text-zinc-500 hover:text-emerald-400'}"
			>
				{#if done}<CheckSquare class="h-4 w-4" />{:else}<Square class="h-4 w-4" />{/if}
			</button>
			<div class="min-w-0 flex-1 space-y-1">
				<p class="break-words {done ? 'text-zinc-500 line-through' : 'font-medium text-zinc-100'}">{item.task}</p>
				<div class="flex flex-wrap items-center gap-2 text-[10px] text-zinc-400">
					{#if item.assignee}<span class="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">{item.assignee}</span>{/if}
					{#if done && item.completed_at}
						<span class="text-emerald-400/80">{m.task_done_on({ date: item.completed_at })}</span>
					{:else if item.due_date}
						<span class={overdue ? 'font-semibold text-rose-400' : 'text-amber-400/90'}>{m.task_due({ date: item.due_date })}</span>
					{/if}
					{#if onselectentry}
						<button type="button" onclick={() => onselectentry(task.entryId)} title={m.task_open_entry()} class="truncate text-amber-400/80 hover:underline">→ {task.entryTitle}</button>
					{/if}
				</div>
			</div>
			<div class="flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100 focus-within:opacity-100">
				<button type="button" onclick={startEdit} title={m.task_edit()} aria-label={m.task_edit()} class="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"><Pencil class="h-3.5 w-3.5" /></button>
				<button type="button" onclick={() => ops.remove(task)} title={m.task_delete()} aria-label={m.task_delete()} class="rounded p-1 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-300"><Trash2 class="h-3.5 w-3.5" /></button>
			</div>
		</div>
	{/if}
</li>
