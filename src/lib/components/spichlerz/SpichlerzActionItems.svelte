<script lang="ts">
	import { enhance } from '$app/forms';
	import CheckSquare from 'lucide-svelte/icons/check-square';
	import Square from 'lucide-svelte/icons/square';
	import Plus from 'lucide-svelte/icons/plus';
	import { m } from '$lib/paraglide/messages.js';
	import type { ActionItem } from '$lib/server/spichlerz';

	let {
		entryId,
		items,
		showAddForm = true,
		onselectentry
	}: {
		entryId?: number;
		items: { meetingId: number; meetingTitle?: string; item: ActionItem; index: number }[];
		showAddForm?: boolean;
		onselectentry?: (id: number) => void;
	} = $props();

	let optimisticStatus = $state<Record<string, 'pending' | 'done'>>({});

	function getStatus(meetingId: number, index: number, actual: 'pending' | 'done') {
		return optimisticStatus[`${meetingId}:${index}`] ?? actual;
	}

	const doneCount = $derived(
		items.filter((row) => getStatus(row.meetingId, row.index, row.item.status) === 'done').length
	);
</script>

<div class="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 space-y-3">
	<div class="flex items-center justify-between">
		<h4 class="flex items-center gap-2 text-xs font-semibold tracking-wider text-amber-400 uppercase">
			<CheckSquare class="h-3.5 w-3.5" />
			<span>{m.meetings_action_items()} ({doneCount}/{items.length})</span>
		</h4>
	</div>

	{#if items.length > 0}
		<ul class="space-y-1.5">
			{#each items as { meetingId, meetingTitle, item, index } (`${meetingId}-${index}`)}
				{@const status = getStatus(meetingId, index, item.status)}
				<li class="rounded-lg border border-zinc-800/70 bg-zinc-900/70 px-3 py-2">
					<form
						method="POST"
						action="?/toggleAction"
						use:enhance={() => {
							const key = `${meetingId}:${index}`;
							optimisticStatus[key] = status === 'done' ? 'pending' : 'done';
							return async ({ update }) => {
								await update();
								delete optimisticStatus[key];
							};
						}}
						class="flex items-start justify-between gap-2.5 text-xs"
					>
						<input type="hidden" name="meetingId" value={meetingId} />
						<input type="hidden" name="itemIndex" value={index} />
						<button
							type="submit"
							class="mt-0.5 shrink-0 transition {status === 'done'
								? 'text-emerald-400 hover:text-zinc-400'
								: 'text-zinc-500 hover:text-emerald-400'}"
						>
							{#if status === 'done'}
								<CheckSquare class="h-4 w-4" />
							{:else}
								<Square class="h-4 w-4" />
							{/if}
						</button>
						<div class="min-w-0 flex-1 space-y-1">
							<p class={status === 'done' ? 'line-through text-zinc-500' : 'text-zinc-100 font-medium'}>
								{item.task}
							</p>
							<div class="flex flex-wrap items-center gap-2 text-[10px] text-zinc-400">
								{#if item.assignee}
									<span class="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">{item.assignee}</span>
								{/if}
								{#if item.due_date}
									<span class="text-amber-400/90">do {item.due_date}</span>
								{/if}
								{#if meetingTitle && onselectentry}
									<button
										type="button"
										onclick={() => onselectentry(meetingId)}
										class="truncate text-amber-400/80 hover:underline"
									>
										→ {meetingTitle}
									</button>
								{/if}
							</div>
						</div>
					</form>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-xs italic text-zinc-500">{m.meetings_no_items()}</p>
	{/if}

	{#if showAddForm && entryId}
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
	{/if}
</div>
