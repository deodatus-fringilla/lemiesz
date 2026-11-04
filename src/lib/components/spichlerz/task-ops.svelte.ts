import { deserialize } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { m } from '$lib/paraglide/messages.js';
import type { RadarTask, TaskItem } from '$lib/server/spichlerz-tasks';

/** One transient message at a time, with an optional undo that stays available for a few seconds. */
export class UndoToast {
	current = $state<{ label: string; undo?: () => Promise<void> } | null>(null);
	isError = $state(false);
	#timer: ReturnType<typeof setTimeout> | undefined;

	show(label: string, undo?: () => Promise<void>, isError = false) {
		clearTimeout(this.#timer);
		this.current = { label, undo };
		this.isError = isError;
		this.#timer = setTimeout(() => this.dismiss(), isError ? 5000 : 7000);
	}
	dismiss() {
		clearTimeout(this.#timer);
		this.current = null;
	}
}

async function post(action: string, fields: Record<string, string | number>) {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.append(k, String(v));
	let result;
	try {
		const res = await fetch(`/spichlerz?/${action}`, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
		result = deserialize(await res.text());
	} catch {
		return { ok: false as const, data: {} };
	}
	if (result.type === 'success') await invalidateAll();
	return result.type === 'success' ? { ok: true as const, data: (result.data ?? {}) as Record<string, unknown> } : { ok: false as const, data: {} };
}

/** Task mutations shared by the Radar and the per-note checklist. Every change reports through the toast. */
export function createTaskOps(toast: UndoToast) {
	const fail = () => toast.show(m.task_error(), undefined, true);

	async function setDone(t: RadarTask, done: boolean, quiet = false) {
		const r = await post('setTaskStatus', { entryId: t.entryId, taskId: t.item.id, status: done ? 'done' : 'pending' });
		if (!r.ok) return fail();
		if (!quiet) toast.show(done ? m.task_toast_done() : m.task_toast_reopened(), () => setDone(t, !done, true));
	}

	async function edit(t: RadarTask, patch: { task: string; assignee: string; due_date: string }) {
		const r = await post('editTask', { entryId: t.entryId, taskId: t.item.id, ...patch });
		if (!r.ok) fail();
		return r.ok;
	}

	async function remove(t: RadarTask) {
		const r = await post('deleteTask', { entryId: t.entryId, taskId: t.item.id });
		if (!r.ok) return fail();
		const { item, index } = r.data.removed as { item: TaskItem; index: number };
		toast.show(m.task_toast_deleted(), async () => {
			const back = await post('restoreTask', { entryId: t.entryId, item: JSON.stringify(item), index });
			if (!back.ok) fail();
		});
	}

	async function clearDone(count: number) {
		if (!confirm(m.task_clear_done_confirm({ count }))) return;
		const r = await post('clearDone', {});
		if (!r.ok) return fail();
		toast.show(m.task_toast_cleared({ count: Number(r.data.cleared ?? count) }));
	}

	return { setDone, edit, remove, clearDone };
}

export type TaskOps = ReturnType<typeof createTaskOps>;
