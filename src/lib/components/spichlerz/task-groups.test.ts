import { describe, expect, it } from 'vitest';
import type { RadarTask } from '$lib/server/spichlerz-tasks';
import { assigneesOf, countTasks, dueGroupOf, filterByAssignee, groupOpenTasks, sortedDone } from './task-groups';

const T = (id: string, extra: Partial<RadarTask['item']> = {}): RadarTask => ({
	entryId: 1,
	entryTitle: 'e',
	item: { id, task: id, status: 'pending', ...extra }
});
const TODAY = '2026-11-04';

describe('task groups', () => {
	it('classifies by due date relative to today', () => {
		expect(dueGroupOf(T('a', { due_date: '2026-11-03' }), TODAY)).toBe('overdue');
		expect(dueGroupOf(T('a', { due_date: '2026-11-04' }), TODAY)).toBe('today');
		expect(dueGroupOf(T('a', { due_date: '2026-11-11' }), TODAY)).toBe('week');
		expect(dueGroupOf(T('a', { due_date: '2026-11-12' }), TODAY)).toBe('later');
		expect(dueGroupOf(T('a'), TODAY)).toBe('nodate');
		expect(dueGroupOf(T('a', { due_date: 'nonsense' }), TODAY)).toBe('nodate');
	});

	it('groups only open tasks, in urgency order, earliest first, skipping empty groups', () => {
		const groups = groupOpenTasks(
			[
				T('late', { due_date: '2026-12-30' }),
				T('b', { due_date: '2026-11-02' }),
				T('a', { due_date: '2026-11-01' }),
				T('done', { due_date: '2026-11-01', status: 'done' }),
				T('free')
			],
			TODAY
		);
		expect(groups.map((g) => [g.group, g.tasks.map((t) => t.item.id)])).toEqual([
			['overdue', ['a', 'b']],
			['later', ['late']],
			['nodate', ['free']]
		]);
	});

	it('counts open vs done and lists done newest first', () => {
		const tasks = [
			T('x', { status: 'done', completed_at: '2026-10-01' }),
			T('y', { status: 'done', completed_at: '2026-11-01' }),
			T('z')
		];
		expect(countTasks(tasks)).toEqual({ open: 1, done: 2 });
		expect(sortedDone(tasks).map((t) => t.item.id)).toEqual(['y', 'x']);
	});

	it('lists assignees once and filters by one', () => {
		const tasks = [T('a', { assignee: 'Ola' }), T('b', { assignee: ' Ola ' }), T('c', { assignee: 'Adam' }), T('d')];
		expect(assigneesOf(tasks)).toEqual(['Adam', 'Ola']);
		expect(filterByAssignee(tasks, 'Ola').map((t) => t.item.id)).toEqual(['a', 'b']);
		expect(filterByAssignee(tasks, '')).toHaveLength(4);
	});
});
