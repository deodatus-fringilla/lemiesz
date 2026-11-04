import {
	getSpichlerzEntry,
	listSpichlerzEntries,
	updateSpichlerzEntry,
	type ActionItem,
	type SpichlerzEntry
} from './spichlerz';

/** Action items live inside their entry (no extra table); these helpers address them by stable id. */
export type TaskItem = ActionItem & { id: string };

export interface RadarTask {
	entryId: number;
	entryTitle: string;
	item: TaskItem;
}

const today = () => new Date().toISOString().slice(0, 10);

function load(entryId: number): SpichlerzEntry {
	const entry = getSpichlerzEntry(entryId);
	if (!entry) throw new Error(`Wpis ${entryId} nie istnieje w Spichlerzu`);
	return entry;
}

function indexOfTask(entry: SpichlerzEntry, taskId: string): number {
	const i = entry.action_items.findIndex((t) => t.id === taskId);
	if (i === -1) throw new Error('Nie znaleziono zadania (mogło zostać już usunięte)');
	return i;
}

/** Every task of every note (open and done), newest-first by entry date. */
export function listAllTasks(): RadarTask[] {
	return listSpichlerzEntries({ include_letters: false }).flatMap((e) =>
		e.action_items.map((item) => ({ entryId: e.id, entryTitle: e.title, item }))
	);
}

export function setTaskStatus(entryId: number, taskId: string, status: 'pending' | 'done'): void {
	const entry = load(entryId);
	const idx = indexOfTask(entry, taskId);
	const items = entry.action_items.map((t, i) => {
		if (i !== idx) return t;
		const next: TaskItem = { ...t, status };
		if (status === 'done') next.completed_at = today();
		else delete next.completed_at;
		return next;
	});
	updateSpichlerzEntry(entryId, { action_items: items });
}

export function editTask(
	entryId: number,
	taskId: string,
	patch: { task?: string; assignee?: string; due_date?: string }
): void {
	const entry = load(entryId);
	const idx = indexOfTask(entry, taskId);
	const text = patch.task?.trim();
	if (patch.task !== undefined && !text) throw new Error('Opis zadania jest wymagany');
	const items = entry.action_items.map((t, i) =>
		i !== idx
			? t
			: {
					...t,
					task: text ?? t.task,
					assignee: patch.assignee !== undefined ? patch.assignee.trim() || undefined : t.assignee,
					due_date: patch.due_date !== undefined ? patch.due_date.trim() || undefined : t.due_date
				}
	);
	updateSpichlerzEntry(entryId, { action_items: items });
}

/** Removes a task for good; returns what was removed so the UI can offer an undo. */
export function deleteTask(entryId: number, taskId: string): { item: TaskItem; index: number } {
	const entry = load(entryId);
	const index = indexOfTask(entry, taskId);
	const item = entry.action_items[index];
	updateSpichlerzEntry(entryId, { action_items: entry.action_items.filter((_, i) => i !== index) });
	return { item, index };
}

/** Puts a previously deleted task back at (about) its old position. */
export function restoreTask(entryId: number, item: TaskItem, index: number): void {
	const entry = load(entryId);
	if (entry.action_items.some((t) => t.id === item.id)) return;
	const items = [...entry.action_items];
	items.splice(Math.max(0, Math.min(index, items.length)), 0, item);
	updateSpichlerzEntry(entryId, { action_items: items });
}

/** Deletes every done task in every note; returns how many were removed. */
export function clearDoneTasks(): number {
	let removed = 0;
	for (const e of listSpichlerzEntries({ include_letters: false })) {
		const kept = e.action_items.filter((t) => t.status !== 'done');
		if (kept.length === e.action_items.length) continue;
		removed += e.action_items.length - kept.length;
		updateSpichlerzEntry(e.id, { action_items: kept });
	}
	return removed;
}
