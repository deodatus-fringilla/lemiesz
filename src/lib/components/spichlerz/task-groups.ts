import type { RadarTask } from '$lib/server/spichlerz-tasks';

export type DueGroup = 'overdue' | 'today' | 'week' | 'later' | 'nodate';
export const DUE_GROUP_ORDER: DueGroup[] = ['overdue', 'today', 'week', 'later', 'nodate'];
export type TaskTab = 'open' | 'done' | 'all';

const DAY = 86_400_000;

/** Whole days from `today` to `due` (both YYYY-MM-DD); negative when the date has passed. */
export function daysUntil(due: string, today: string): number {
	return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
}

export function dueGroupOf(task: RadarTask, today: string): DueGroup {
	const due = task.item.due_date;
	if (!due || Number.isNaN(Date.parse(due))) return 'nodate';
	const d = daysUntil(due, today);
	return d < 0 ? 'overdue' : d === 0 ? 'today' : d <= 7 ? 'week' : 'later';
}

export const isOpen = (t: RadarTask) => t.item.status === 'pending';

export function countTasks(tasks: RadarTask[]): { open: number; done: number } {
	const open = tasks.filter(isOpen).length;
	return { open, done: tasks.length - open };
}

/** The assignee names present, for the person filter. */
export function assigneesOf(tasks: RadarTask[]): string[] {
	return [...new Set(tasks.map((t) => t.item.assignee?.trim()).filter((a): a is string => !!a))].sort((a, b) =>
		a.localeCompare(b, 'pl')
	);
}

export function filterByAssignee(tasks: RadarTask[], assignee: string): RadarTask[] {
	return assignee ? tasks.filter((t) => t.item.assignee?.trim() === assignee) : tasks;
}

/** Open tasks grouped by urgency (empty groups omitted); earliest due date first inside a group. */
export function groupOpenTasks(tasks: RadarTask[], today: string): { group: DueGroup; tasks: RadarTask[] }[] {
	const open = tasks.filter(isOpen);
	return DUE_GROUP_ORDER.map((group) => ({
		group,
		tasks: open
			.filter((t) => dueGroupOf(t, today) === group)
			.sort((a, b) => (a.item.due_date ?? '').localeCompare(b.item.due_date ?? '') || a.item.task.localeCompare(b.item.task, 'pl'))
	})).filter((g) => g.tasks.length > 0);
}

/** Done tasks, most recently completed first. */
export function sortedDone(tasks: RadarTask[]): RadarTask[] {
	return tasks
		.filter((t) => !isOpen(t))
		.sort((a, b) => (b.item.completed_at ?? '').localeCompare(a.item.completed_at ?? ''));
}
