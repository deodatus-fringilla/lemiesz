<script lang="ts">
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import Maximize2 from 'lucide-svelte/icons/maximize-2';
	import Minimize2 from 'lucide-svelte/icons/minimize-2';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import { m } from '$lib/paraglide/messages.js';
	import type { RadarTask } from '$lib/server/spichlerz-tasks';
	import SpichlerzTaskRow from './SpichlerzTaskRow.svelte';
	import SpichlerzUndoToast from './SpichlerzUndoToast.svelte';
	import { UndoToast, createTaskOps } from './task-ops.svelte';
	import { assigneesOf, countTasks, filterByAssignee, groupOpenTasks, sortedDone, type DueGroup, type TaskTab } from './task-groups';

	let {
		tasks,
		zenMode,
		ontogglezen,
		onback,
		onselectentry
	}: {
		tasks: RadarTask[];
		zenMode: boolean;
		ontogglezen: () => void;
		onback: () => void;
		onselectentry: (entryId: number) => void;
	} = $props();

	const toast = new UndoToast();
	const ops = createTaskOps(toast);

	let tab = $state<TaskTab>('open');
	let assignee = $state('');

	const today = new Date().toLocaleDateString('sv-SE');
	const counts = $derived(countTasks(tasks));
	const people = $derived(assigneesOf(tasks));
	const filtered = $derived(filterByAssignee(tasks, assignee));
	const groups = $derived(groupOpenTasks(filtered, today));
	const done = $derived(sortedDone(filtered));
	const tabs = $derived<{ id: TaskTab; label: string; n: number }[]>([
		{ id: 'open', label: m.task_tab_open(), n: counts.open },
		{ id: 'done', label: m.task_tab_done(), n: counts.done },
		{ id: 'all', label: m.task_tab_all(), n: tasks.length }
	]);
	const groupLabel: Record<DueGroup, () => string> = {
		overdue: () => m.task_group_overdue(),
		today: () => m.task_group_today(),
		week: () => m.task_group_week(),
		later: () => m.task_group_later(),
		nodate: () => m.task_group_nodate()
	};
	const ghost = 'inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700';
</script>

<div class="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 pb-3">
	<div>
		<h2 class="text-lg font-bold text-amber-400">{m.spichlerz_todo_radar()}</h2>
		<p class="text-xs text-zinc-400">{m.spichlerz_todo_radar_subtitle()}</p>
		<p class="mt-1 font-mono text-xs text-zinc-300">{m.task_count_summary(counts)}</p>
	</div>
	<div class="flex gap-1.5">
		<button type="button" onclick={onback} class={ghost}><ArrowLeft class="h-3.5 w-3.5" />{m.task_back_to_notes()}</button>
		<button type="button" onclick={ontogglezen} class={ghost}>
			{#if zenMode}<Minimize2 class="h-3.5 w-3.5" />{:else}<Maximize2 class="h-3.5 w-3.5" />{/if}
			<span class="hidden sm:inline">{zenMode ? m.spichlerz_zen_exit() : m.spichlerz_zen_enter()}</span>
		</button>
	</div>
</div>

<div class="flex flex-wrap items-center gap-2 text-xs">
	<div class="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5" role="tablist">
		{#each tabs as t (t.id)}
			<button
				type="button" role="tab" aria-selected={tab === t.id} onclick={() => (tab = t.id)}
				class="rounded-md px-2.5 py-1 font-medium transition {tab === t.id ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'}"
			>
				{t.label} <span class="font-mono text-[10px] opacity-70">{t.n}</span>
			</button>
		{/each}
	</div>
	{#if people.length > 0}
		<select bind:value={assignee} aria-label={m.task_filter_label()} class="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-zinc-200">
			<option value="">{m.task_filter_all()}</option>
			{#each people as p (p)}<option value={p}>{p}</option>{/each}
		</select>
	{/if}
	{#if counts.done > 0 && tab !== 'open'}
		<button type="button" onclick={() => ops.clearDone(counts.done)} class="ml-auto inline-flex items-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-rose-300 hover:bg-rose-500/20">
			<Trash2 class="h-3.5 w-3.5" />{m.task_clear_done()}
		</button>
	{/if}
</div>

{#if tab !== 'done'}
	{#each groups as g (g.group)}
		<section class="space-y-1.5">
			<h3 class="text-[10px] font-semibold tracking-wider uppercase {g.group === 'overdue' ? 'text-rose-400' : 'text-zinc-500'}">
				{groupLabel[g.group]()} <span class="font-mono">({g.tasks.length})</span>
			</h3>
			<ul class="space-y-1.5">
				{#each g.tasks as t (`${t.entryId}-${t.item.id}`)}<SpichlerzTaskRow task={t} {ops} {today} {onselectentry} />{/each}
			</ul>
		</section>
	{:else}
		{#if tab === 'open'}<p class="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500 italic">{m.task_empty_open()}</p>{/if}
	{/each}
{/if}

{#if tab !== 'open'}
	<section class="space-y-1.5">
		{#if tab === 'all' && done.length > 0}
			<h3 class="text-[10px] font-semibold tracking-wider text-emerald-400/80 uppercase">{m.task_tab_done()} <span class="font-mono">({done.length})</span></h3>
		{/if}
		<ul class="space-y-1.5">
			{#each done as t (`${t.entryId}-${t.item.id}`)}<SpichlerzTaskRow task={t} {ops} {today} {onselectentry} />{/each}
		</ul>
		{#if tab === 'done' && done.length === 0}<p class="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500 italic">{m.task_empty_done()}</p>{/if}
	</section>
{/if}

<SpichlerzUndoToast {toast} />
