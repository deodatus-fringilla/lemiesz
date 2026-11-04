import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	listSpichlerzEntries,
	listSpichlerzTags,
	createSpichlerzEntry,
	updateSpichlerzEntry,
	deleteSpichlerzEntry,
	togglePin,
	setColorTag,
	toggleSpichlerzTask,
	addSpichlerzTask,
	quickCapture,
	type ColorTag,
	type MeetingCategory
} from '$lib/server/spichlerz';
import {
	clearDoneTasks,
	deleteTask,
	editTask,
	listAllTasks,
	restoreTask,
	setTaskStatus,
	type TaskItem
} from '$lib/server/spichlerz-tasks';
import { listCorrespondenceThreads } from '$lib/server/correspondence';
import { db } from '$lib/server/db';

export const load: PageServerLoad = ({ url, locals }) => {
	const category = url.searchParams.get('category') as MeetingCategory | null;
	const threadIdParam = url.searchParams.get('thread_id');
	const thread_id = threadIdParam ? Number(threadIdParam) : undefined;
	const q = url.searchParams.get('q') || undefined;
	const tag = url.searchParams.get('tag') || undefined;
	const entries = listSpichlerzEntries({
		category: category || undefined,
		thread_id: Number.isInteger(thread_id) ? thread_id : undefined,
		q,
		tag
	});

	const tags = listSpichlerzTags();
	const tasks = listAllTasks();
	const threads = listCorrespondenceThreads();

	const letters = db
		.prepare(
			'SELECT id, thread_id, turn_number, direction, date_label FROM correspondence_letters ORDER BY thread_id, turn_number'
		)
		.all() as { id: number; thread_id: number; turn_number: number; direction: string; date_label: string }[];

	const mediaList = db
		.prepare('SELECT id, title, artist_or_author FROM media_assets ORDER BY id DESC')
		.all() as { id: number; title: string; artist_or_author: string }[];

	const sourcesList = db
		.prepare('SELECT id, work, section_ref FROM sources ORDER BY id')
		.all() as { id: number; work: string; section_ref: string }[];

	const idParam = url.searchParams.get('id');
	const uidParam = url.searchParams.get('uid');

	const selectedUid =
		uidParam ||
		(idParam ? (idParam.startsWith('l-') || idParam.startsWith('m-') ? idParam : `m-${idParam}`) : (entries[0]?.uid ?? null));

	return {
		entries,
		tasks,
		tags,
		threads,
		letters,
		mediaList,
		sourcesList,
		activeCategory: (category || 'all') as MeetingCategory | 'all',
		activeThreadId: thread_id,
		activeTag: tag || null,
		searchQuery: q || '',
		selectedUid,
		user: locals.user
	};
};

function parseNullableId(val: FormDataEntryValue | null): number | null {
	if (!val) return null;
	const n = Number(val);
	return Number.isInteger(n) && n > 0 ? n : null;
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();
		const title = String(form.get('title') || '').trim();
		const body = String(form.get('body') || '').trim();
		if (!title || !body) return fail(400, { error: 'Tytuł oraz treść wpisu są wymagane' });

		try {
			const created = createSpichlerzEntry({
				title,
				category: (String(form.get('category') || 'general') as MeetingCategory),
				meeting_date: String(form.get('meeting_date') || '').trim() || undefined,
				attendees: String(form.get('attendees') || '').trim() || undefined,
				summary: String(form.get('summary') || '').trim() || undefined,
				body,
				tags: String(form.get('tags') || '').trim() || null,
				is_pinned: form.get('is_pinned') === '1',
				color_tag: (String(form.get('color_tag') || 'zinc') as ColorTag),
				thread_id: parseNullableId(form.get('thread_id')),
				after_letter_id: parseNullableId(form.get('after_letter_id')),
				media_id: parseNullableId(form.get('media_id')),
				source_id: parseNullableId(form.get('source_id')),
				created_by: locals.user?.username || locals.user?.id || 'admin'
			});
			return { success: true, entryId: created.id };
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Brak identyfikatora wpisu' });

		try {
			updateSpichlerzEntry(id, {
				title: String(form.get('title') || '').trim(),
				category: (String(form.get('category') || 'general') as MeetingCategory),
				meeting_date: String(form.get('meeting_date') || '').trim(),
				attendees: String(form.get('attendees') || '').trim(),
				summary: String(form.get('summary') || '').trim(),
				body: String(form.get('body') || '').trim(),
				tags: String(form.get('tags') || '').trim() || null,
				is_pinned: form.get('is_pinned') === '1',
				color_tag: (String(form.get('color_tag') || 'zinc') as ColorTag),
				thread_id: parseNullableId(form.get('thread_id')),
				after_letter_id: parseNullableId(form.get('after_letter_id')),
				media_id: parseNullableId(form.get('media_id')),
				source_id: parseNullableId(form.get('source_id'))
			});
			return { success: true, updated: id };
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Brak identyfikatora wpisu' });
		try {
			deleteSpichlerzEntry(id);
			return { success: true, deleted: id };
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}
	},

	togglePin: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Brak identyfikatora wpisu' });
		try {
			togglePin(id);
			return { success: true };
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}
	},

	setColor: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const color_tag = String(form.get('color_tag') || 'zinc') as ColorTag;
		if (!id) return fail(400, { error: 'Brak identyfikatora wpisu' });
		try {
			setColorTag(id, color_tag);
			return { success: true };
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}
	},

	toggleAction: async ({ request }) => {
		const form = await request.formData();
		const meetingId = Number(form.get('meetingId'));
		const itemIndex = Number(form.get('itemIndex'));
		if (!meetingId || Number.isNaN(itemIndex)) return fail(400, { error: 'Nieprawidłowe dane zadania' });
		try {
			toggleSpichlerzTask(meetingId, itemIndex);
			return { success: true };
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}
	},

	addTask: async ({ request }) => {
		const form = await request.formData();
		const entryId = Number(form.get('entryId'));
		const task = String(form.get('task') || '').trim();
		if (!entryId || !task) return fail(400, { error: 'Opis zadania jest wymagany' });
		try {
			addSpichlerzTask(entryId, {
				task,
				assignee: String(form.get('assignee') || '').trim() || undefined,
				due_date: String(form.get('due_date') || '').trim() || undefined
			});
			return { success: true };
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}
	},

	setTaskStatus: async ({ request }) => {
		const form = await request.formData();
		const entryId = Number(form.get('entryId'));
		const taskId = String(form.get('taskId') || '');
		const status = form.get('status') === 'done' ? 'done' : 'pending';
		if (!entryId || !taskId) return fail(400, { error: 'Nieprawidłowe dane zadania' });
		try {
			setTaskStatus(entryId, taskId, status);
			return { success: true };
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}
	},

	editTask: async ({ request }) => {
		const form = await request.formData();
		const entryId = Number(form.get('entryId'));
		const taskId = String(form.get('taskId') || '');
		if (!entryId || !taskId) return fail(400, { error: 'Nieprawidłowe dane zadania' });
		try {
			editTask(entryId, taskId, {
				task: String(form.get('task') ?? ''),
				assignee: String(form.get('assignee') ?? ''),
				due_date: String(form.get('due_date') ?? '')
			});
			return { success: true };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	},

	deleteTask: async ({ request }) => {
		const form = await request.formData();
		const entryId = Number(form.get('entryId'));
		const taskId = String(form.get('taskId') || '');
		if (!entryId || !taskId) return fail(400, { error: 'Nieprawidłowe dane zadania' });
		try {
			const { item, index } = deleteTask(entryId, taskId);
			return { success: true, removed: { item, index } };
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}
	},

	restoreTask: async ({ request }) => {
		const form = await request.formData();
		const entryId = Number(form.get('entryId'));
		const index = Number(form.get('index'));
		try {
			const item = JSON.parse(String(form.get('item') || '')) as TaskItem;
			if (!entryId || !item?.id || !item.task) return fail(400, { error: 'Nieprawidłowe dane zadania' });
			restoreTask(entryId, item, Number.isInteger(index) ? index : 0);
			return { success: true };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	},

	clearDone: async () => {
		try {
			return { success: true, cleared: clearDoneTasks() };
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}
	},

	quickCapture: async ({ request, locals }) => {
		const form = await request.formData();
		const text = String(form.get('text') || '').trim();
		const mode = (String(form.get('mode') || 'task') === 'note' ? 'note' : 'task') as 'task' | 'note';
		if (!text) return fail(400, { error: 'Treść jest wymagana' });
		try {
			const entry = quickCapture({
				text,
				mode,
				assignee: String(form.get('assignee') || '').trim() || undefined,
				due_date: String(form.get('due_date') || '').trim() || undefined,
				created_by: locals.user?.username || locals.user?.id || 'admin'
			});
			return { success: true, entryId: entry.id, entryTitle: entry.title, mode };
		} catch (e) {
			return fail(500, { error: (e as Error).message });
		}
	}
};
