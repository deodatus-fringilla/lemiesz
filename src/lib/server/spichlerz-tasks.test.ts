import { describe, expect, it } from 'vitest';
import { addSpichlerzTask, createSpichlerzEntry, deleteSpichlerzEntry, getSpichlerzEntry, quickCapture } from './spichlerz';
import { clearDoneTasks, deleteTask, editTask, listAllTasks, restoreTask, setTaskStatus } from './spichlerz-tasks';

const noteWithTasks = (...tasks: string[]) => {
	const e = createSpichlerzEntry({ title: `Zadania ${Math.random()}`, body: 'x' });
	for (const t of tasks) addSpichlerzTask(e.id, { task: t });
	return e.id;
};
const ids = (entryId: number) => getSpichlerzEntry(entryId)!.action_items.map((t) => t.id);

describe('Spichlerz tasks by stable id', () => {
	it('gives every task a unique id, also for legacy rows without one', () => {
		const e = createSpichlerzEntry({
			title: 'Legacy',
			body: 'x',
			action_items: [{ task: 'a', status: 'pending' }, { task: 'b', status: 'pending' }]
		});
		const found = ids(e.id);
		expect(new Set(found).size).toBe(2);
		expect(found.every(Boolean)).toBe(true);
	});

	it('sets status by id and records / clears the completion date', () => {
		const id = noteWithTasks('one', 'two');
		const [first] = ids(id);
		setTaskStatus(id, first, 'done');
		let t = getSpichlerzEntry(id)!.action_items[0];
		expect(t.status).toBe('done');
		expect(t.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		setTaskStatus(id, first, 'pending');
		t = getSpichlerzEntry(id)!.action_items[0];
		expect(t.status).toBe('pending');
		expect(t.completed_at).toBeUndefined();
	});

	it('edits only the targeted task and rejects an empty description', () => {
		const id = noteWithTasks('one', 'two');
		const [first, second] = ids(id);
		editTask(id, second, { task: ' two!! ', assignee: 'Ola', due_date: '2026-12-01' });
		const items = getSpichlerzEntry(id)!.action_items;
		expect(items[0].task).toBe('one');
		expect(items[1]).toMatchObject({ task: 'two!!', assignee: 'Ola', due_date: '2026-12-01' });
		expect(() => editTask(id, first, { task: '  ' })).toThrow();
	});

	it('deletes by id (ids stay valid for the rest) and can restore at the old position', () => {
		const id = noteWithTasks('a', 'b', 'c');
		const [a, b, c] = ids(id);
		const removed = deleteTask(id, b);
		expect(ids(id)).toEqual([a, c]);
		expect(() => deleteTask(id, b)).toThrow();
		restoreTask(id, removed.item, removed.index);
		expect(ids(id)).toEqual([a, b, c]);
		restoreTask(id, removed.item, removed.index);
		expect(ids(id)).toEqual([a, b, c]);
	});

	it('clears only done tasks across all notes', () => {
		const id = noteWithTasks('keep', 'drop');
		const [, drop] = ids(id);
		setTaskStatus(id, drop, 'done');
		expect(clearDoneTasks()).toBeGreaterThanOrEqual(1);
		expect(getSpichlerzEntry(id)!.action_items.map((t) => t.task)).toEqual(['keep']);
		expect(listAllTasks().some((t) => t.item.id === drop)).toBe(false);
	});

	it('protects the ToDo inbox note from deletion, but not ordinary notes', () => {
		const inbox = quickCapture({ text: 'zadanie do skrzynki' });
		expect(getSpichlerzEntry(inbox.id)?.is_backlog).toBe(true);
		expect(() => deleteSpichlerzEntry(inbox.id)).toThrow(/Backlog/);
		expect(getSpichlerzEntry(inbox.id)).not.toBeNull();
		const plain = createSpichlerzEntry({ title: 'zwykła', body: 'x' });
		expect(getSpichlerzEntry(plain.id)?.is_backlog).toBe(false);
		expect(deleteSpichlerzEntry(plain.id)).toBe(true);
	});
});
