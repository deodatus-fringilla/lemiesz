import { db } from '$lib/server/db';
import { prepareFtsQuery } from '$lib/server/rag/fts';

export const MEETING_CATEGORIES = [
	'epistolary',
	'strategy',
	'doctrine',
	'campaign',
	'operational',
	'general'
] as const;

export type MeetingCategory = (typeof MEETING_CATEGORIES)[number];
export type SpichlerzCategory = MeetingCategory;

export const COLOR_TAGS = ['zinc', 'amber', 'purple', 'blue', 'emerald', 'rose'] as const;
export type ColorTag = (typeof COLOR_TAGS)[number];

export interface ActionItem {
	/** Stable task id. Older rows have none; they get a deterministic `legacy-…` id when read. */
	id?: string;
	task: string;
	assignee?: string;
	due_date?: string;
	status: 'pending' | 'done';
	completed_at?: string;
}

export interface SpichlerzEntry {
	uid: string;
	id: number;
	entry_type: 'minute' | 'letter';
	meeting_date: string;
	title: string;
	category: MeetingCategory;
	thread_id: number | null;
	after_letter_id: number | null;
	media_id: number | null;
	source_id: number | null;
	is_pinned: boolean;
	color_tag: ColorTag;
	attendees: string;
	agenda: string | null;
	summary: string;
	body: string;
	action_items: (ActionItem & { id: string })[];
	tags: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
	// Joined relational fields
	thread_title?: string | null;
	thread_slug?: string | null;
	letter_turn?: number | null;
	letter_direction?: 'outbound' | 'inbound' | null;
	letter_filename?: string | null;
	key_claims?: string[];
	media_title?: string | null;
	media_artist?: string | null;
	source_ref?: string | null;
	kuznia_id?: number | null;
}

export type MeetingMinute = SpichlerzEntry;

type SpichlerzRow = Omit<SpichlerzEntry, 'action_items' | 'is_pinned'> & {
	action_items_json: string;
	is_pinned: number;
};

function fromRow(r: SpichlerzRow): SpichlerzEntry {
	const { action_items_json, is_pinned, ...rest } = r;
	let action_items: SpichlerzEntry['action_items'] = [];
	try {
		const parsed: ActionItem[] = JSON.parse(action_items_json || '[]');
		action_items = parsed.map((item, idx) => ({ ...item, id: item.id ?? `legacy-${r.id}-${idx}` }));
	} catch {
		action_items = [];
	}
	return {
		...rest,
		uid: `m-${r.id}`,
		entry_type: 'minute',
		is_pinned: Boolean(is_pinned),
		color_tag: COLOR_TAGS.includes(rest.color_tag as ColorTag) ? (rest.color_tag as ColorTag) : 'zinc',
		action_items
	};
}

export interface SpichlerzFilter {
	category?: MeetingCategory;
	thread_id?: number;
	media_id?: number;
	source_id?: number;
	is_pinned?: boolean;
	has_open_tasks?: boolean;
	include_letters?: boolean;
	tag?: string;
	q?: string;
	limit?: number;
}

export type MeetingFilter = SpichlerzFilter;

export interface SpichlerzInput {
	meeting_date?: string;
	title: string;
	category?: MeetingCategory;
	thread_id?: number | null;
	after_letter_id?: number | null;
	media_id?: number | null;
	source_id?: number | null;
	is_pinned?: boolean;
	color_tag?: ColorTag;
	attendees?: string;
	agenda?: string | null;
	summary?: string;
	body?: string;
	action_items?: ActionItem[];
	tags?: string | null;
	created_by?: string;
}

export type MeetingInput = SpichlerzInput;

const SELECT_JOINS = `
	LEFT JOIN correspondence_threads t ON t.id = m.thread_id
	LEFT JOIN correspondence_letters l ON l.id = m.after_letter_id
	LEFT JOIN media_assets ma ON ma.id = m.media_id
	LEFT JOIN sources s ON s.id = m.source_id
`;

const SELECT_COLUMNS = `
	m.*,
	t.title AS thread_title,
	t.slug AS thread_slug,
	l.turn_number AS letter_turn,
	ma.title AS media_title,
	ma.artist_or_author AS media_artist,
	CASE WHEN s.id IS NOT NULL THEN (s.work || ' ' || s.section_ref) ELSE NULL END AS source_ref,
	(
		SELECT k.id FROM kuznia_deliberations k
		WHERE (m.media_id IS NOT NULL AND k.media_id = m.media_id)
		   OR (m.source_id IS NOT NULL AND k.source_id = m.source_id)
		LIMIT 1
	) AS kuznia_id
`;

const LETTER_ISO_DATES: Record<number, string> = {
	1: '2026-09-17',
	2: '2026-09-22',
	3: '2026-09-26',
	4: '2026-10-01',
	5: '2026-10-05',
	6: '2026-10-06',
	7: '2026-10-09',
	8: '2026-10-14',
	9: '2026-10-18'
};

function toRoman(n: number): string {
	const map = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
	return map[n - 1] ?? String(n);
}

interface LetterQueryRow {
	id: number;
	thread_id: number;
	turn_number: number;
	direction: 'outbound' | 'inbound';
	sender: string;
	recipient: string;
	date_label: string;
	filename: string;
	summary_pl: string;
	summary_en: string;
	body: string;
	key_claims_json: string;
	created_at: string;
	thread_title?: string;
	thread_slug?: string;
}

function letterToSpichlerzEntry(l: LetterQueryRow): SpichlerzEntry {
	const isOutbound = l.direction === 'outbound';
	const turn = l.turn_number;
	const letterNum = isOutbound ? Math.ceil(turn / 2) : Math.floor(turn / 2);
	const roman = toRoman(letterNum);
	const prefix = isOutbound
		? `List ${roman} (do Grzegorza Brauna)`
		: `Odpowiedź ${roman} (Biuro Poselskie G. Brauna / T. Pracownik)`;

	const colonIdx = l.summary_pl.indexOf(':');
	const subtitle = colonIdx > -1 ? l.summary_pl.slice(colonIdx + 1).trim() : l.summary_pl;

	let keyClaims: string[] = [];
	try {
		keyClaims = JSON.parse(l.key_claims_json || '[]');
	} catch {
		keyClaims = [];
	}

	return {
		uid: `l-${l.id}`,
		id: l.id,
		entry_type: 'letter',
		meeting_date: LETTER_ISO_DATES[turn] ?? l.created_at?.slice(0, 10) ?? '2026-10-01',
		title: `${prefix}: ${subtitle}`,
		category: 'epistolary',
		thread_id: l.thread_id,
		after_letter_id: null,
		media_id: null,
		source_id: null,
		is_pinned: turn === 9,
		color_tag: isOutbound ? 'purple' : 'blue',
		attendees: `${l.sender} → ${l.recipient}`,
		agenda: `${l.filename} (${l.date_label})`,
		summary: l.summary_pl,
		body: l.body,
		action_items: [],
		tags: 'braun, korona, list, epistolary, polemika, lubmin, dysputa',
		created_by: isOutbound ? 'Bogdan Zięba' : 'Teresa Pracownik',
		created_at: l.created_at,
		updated_at: l.created_at,
		thread_title: l.thread_title ?? null,
		thread_slug: l.thread_slug ?? null,
		letter_turn: turn,
		letter_direction: l.direction,
		letter_filename: l.filename,
		key_claims: keyClaims
	};
}

export function listSpichlerzEntries(filter: SpichlerzFilter = {}): SpichlerzEntry[] {
	const where: string[] = [];
	const params: unknown[] = [];

	if (filter.category) {
		where.push('m.category = ?');
		params.push(filter.category);
	}
	if (filter.thread_id !== undefined) {
		where.push('m.thread_id = ?');
		params.push(filter.thread_id);
	}
	if (filter.media_id !== undefined) {
		where.push('m.media_id = ?');
		params.push(filter.media_id);
	}
	if (filter.source_id !== undefined) {
		where.push('m.source_id = ?');
		params.push(filter.source_id);
	}
	if (filter.is_pinned !== undefined) {
		where.push('m.is_pinned = ?');
		params.push(filter.is_pinned ? 1 : 0);
	}
	if (filter.tag?.trim()) {
		where.push('m.tags LIKE ?');
		params.push(`%${filter.tag.trim()}%`);
	}

	let from = `meeting_minutes m ${SELECT_JOINS}`;

	if (filter.q?.trim()) {
		const q = filter.q
			.split(/\s+/)
			.map((w) => prepareFtsQuery(w, 'pl', 'and'))
			.filter(Boolean)
			.join(' AND ');
		if (!q) return [];
		from = `fts_meetings f
			JOIN meeting_minutes m ON m.id = f.rowid
			${SELECT_JOINS}`;
		where.push('fts_meetings MATCH ?');
		params.push(q);
	}

	const sql = `
		SELECT ${SELECT_COLUMNS}
		FROM ${from}
		${where.length ? `WHERE ${where.join(' AND ')}` : ''}
		ORDER BY m.is_pinned DESC, m.meeting_date DESC, m.id DESC
		LIMIT ?
	`;

	const rows = db.prepare(sql).all(...params, filter.limit ?? 100) as SpichlerzRow[];
	let entries = rows.map(fromRow);

	if (filter.has_open_tasks) {
		return entries.filter((e) => e.action_items.some((a) => a.status === 'pending'));
	}

	// Ingest correspondence letters if epistolary or all categories are selected
	let letterEntries: SpichlerzEntry[] = [];
	const canIncludeLetters =
		filter.include_letters !== false &&
		(!filter.category || filter.category === 'epistolary') &&
		!filter.media_id &&
		!filter.source_id;

	if (canIncludeLetters) {
		const lWhere: string[] = [];
		const lParams: unknown[] = [];

		if (filter.thread_id !== undefined) {
			lWhere.push('l.thread_id = ?');
			lParams.push(filter.thread_id);
		}
		if (filter.is_pinned !== undefined) {
			lWhere.push(filter.is_pinned ? 'l.turn_number = 9' : 'l.turn_number != 9');
		}
		if (filter.tag?.trim()) {
			const tagLower = filter.tag.trim().toLowerCase();
			const matchLetter = [
				'braun',
				'korona',
				'list',
				'listy',
				'epistolary',
				'polemika',
				'lubmin',
				'dysputa',
				'szwajcaria'
			].some((k) => tagLower.includes(k) || k.includes(tagLower));
			if (!matchLetter) {
				lWhere.push('0 = 1');
			}
		}
		if (filter.q?.trim()) {
			lWhere.push(
				'(l.body LIKE ? OR l.summary_pl LIKE ? OR l.sender LIKE ? OR l.recipient LIKE ? OR l.filename LIKE ?)'
			);
			const qLike = `%${filter.q.trim()}%`;
			lParams.push(qLike, qLike, qLike, qLike, qLike);
		}

		const lSql = `
			SELECT l.*, t.title AS thread_title, t.slug AS thread_slug
			FROM correspondence_letters l
			JOIN correspondence_threads t ON t.id = l.thread_id
			${lWhere.length ? `WHERE ${lWhere.join(' AND ')}` : ''}
			ORDER BY l.turn_number DESC
		`;
		const lRows = db.prepare(lSql).all(...lParams) as LetterQueryRow[];
		letterEntries = lRows.map(letterToSpichlerzEntry);
	}

	const all = [...entries, ...letterEntries].sort((a, b) => {
		if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
		return b.meeting_date.localeCompare(a.meeting_date) || b.id - a.id;
	});

	return filter.limit ? all.slice(0, filter.limit) : all;
}

export function getSpichlerzEntry(id: number | string): SpichlerzEntry | null {
	if (typeof id === 'string' && id.startsWith('l-')) {
		const letterId = Number(id.slice(2));
		const row = db
			.prepare(
				`
			SELECT l.*, t.title AS thread_title, t.slug AS thread_slug
			FROM correspondence_letters l
			JOIN correspondence_threads t ON t.id = l.thread_id
			WHERE l.id = ?
		`
			)
			.get(letterId) as LetterQueryRow | undefined;
		return row ? letterToSpichlerzEntry(row) : null;
	}

	const numId = typeof id === 'number' ? id : Number(id.replace(/^m-/, ''));
	if (!Number.isInteger(numId) || numId <= 0) return null;

	const sql = `
		SELECT ${SELECT_COLUMNS}
		FROM meeting_minutes m
		${SELECT_JOINS}
		WHERE m.id = ?
	`;
	const row = db.prepare(sql).get(numId) as SpichlerzRow | undefined;
	return row ? fromRow(row) : null;
}

export function createSpichlerzEntry(input: SpichlerzInput): SpichlerzEntry {
	const title = input.title?.trim();
	if (!title) throw new Error('Tytuł wpisu jest wymagany');

	const rawBody = input.body?.trim() || '';
	const rawSummary = input.summary?.trim() || '';
	if (!rawBody && !rawSummary) {
		throw new Error('Treść lub podsumowanie wpisu jest wymagane');
	}

	const body = rawBody || rawSummary;
	const summary = rawSummary || rawBody.replace(/^#+\s*/gm, '').slice(0, 180).trim();
	const attendees = input.attendees?.trim() || input.created_by?.trim() || 'Zespół';
	const category: MeetingCategory = input.category ?? 'general';
	const date = input.meeting_date?.trim() || new Date().toISOString().slice(0, 10);
	const isPinned = input.is_pinned ? 1 : 0;
	const colorTag: ColorTag =
		input.color_tag && COLOR_TAGS.includes(input.color_tag) ? input.color_tag : 'zinc';
	const actionItemsJson = JSON.stringify(input.action_items || []);

	const info = db
		.prepare(
			`
		INSERT INTO meeting_minutes (
			meeting_date, title, category, thread_id, after_letter_id,
			media_id, source_id, is_pinned, color_tag,
			attendees, agenda, summary, body, action_items_json, tags, created_by
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
		)
		.run(
			date,
			title,
			category,
			input.thread_id ?? null,
			input.after_letter_id ?? null,
			input.media_id ?? null,
			input.source_id ?? null,
			isPinned,
			colorTag,
			attendees,
			input.agenda?.trim() || null,
			summary,
			body,
			actionItemsJson,
			input.tags?.trim() || null,
			input.created_by?.trim() || 'admin'
		);

	return getSpichlerzEntry(Number(info.lastInsertRowid))!;
}

export function updateSpichlerzEntry(id: number, input: Partial<SpichlerzInput>): SpichlerzEntry {
	const current = getSpichlerzEntry(id);
	if (!current) throw new Error(`Wpis ${id} nie istnieje w Spichlerzu`);

	const title = input.title !== undefined ? input.title.trim() : current.title;
	const category = input.category ?? current.category;
	const date = input.meeting_date !== undefined ? input.meeting_date.trim() : current.meeting_date;
	const attendees = input.attendees !== undefined ? input.attendees.trim() : current.attendees;
	const agenda = input.agenda !== undefined ? input.agenda?.trim() || null : current.agenda;
	const summary = input.summary !== undefined ? input.summary.trim() : current.summary;
	const body = input.body !== undefined ? input.body.trim() : current.body;
	const threadId = input.thread_id !== undefined ? input.thread_id : current.thread_id;
	const afterLetterId =
		input.after_letter_id !== undefined ? input.after_letter_id : current.after_letter_id;
	const mediaId = input.media_id !== undefined ? input.media_id : current.media_id;
	const sourceId = input.source_id !== undefined ? input.source_id : current.source_id;
	const isPinned =
		input.is_pinned !== undefined ? (input.is_pinned ? 1 : 0) : current.is_pinned ? 1 : 0;
	const colorTag: ColorTag =
		input.color_tag && COLOR_TAGS.includes(input.color_tag) ? input.color_tag : current.color_tag;
	const tags = input.tags !== undefined ? input.tags?.trim() || null : current.tags;
	const actionItemsJson =
		input.action_items !== undefined
			? JSON.stringify(input.action_items)
			: JSON.stringify(current.action_items);

	db.prepare(
		`
		UPDATE meeting_minutes SET
			meeting_date = ?,
			title = ?,
			category = ?,
			thread_id = ?,
			after_letter_id = ?,
			media_id = ?,
			source_id = ?,
			is_pinned = ?,
			color_tag = ?,
			attendees = ?,
			agenda = ?,
			summary = ?,
			body = ?,
			action_items_json = ?,
			tags = ?,
			updated_at = datetime('now')
		WHERE id = ?
	`
	).run(
		date,
		title,
		category,
		threadId,
		afterLetterId,
		mediaId,
		sourceId,
		isPinned,
		colorTag,
		attendees,
		agenda,
		summary,
		body,
		actionItemsJson,
		tags,
		id
	);

	return getSpichlerzEntry(id)!;
}

export function deleteSpichlerzEntry(id: number): boolean {
	const info = db.prepare('DELETE FROM meeting_minutes WHERE id = ?').run(id);
	return info.changes > 0;
}

export function togglePin(entryId: number): SpichlerzEntry {
	const current = getSpichlerzEntry(entryId);
	if (!current) throw new Error(`Wpis ${entryId} nie istnieje w Spichlerzu`);
	return updateSpichlerzEntry(entryId, { is_pinned: !current.is_pinned });
}

export function setColorTag(entryId: number, color_tag: ColorTag): SpichlerzEntry {
	return updateSpichlerzEntry(entryId, { color_tag });
}

export function toggleSpichlerzTask(
	entryId: number,
	taskIndex: number,
	newStatus?: 'pending' | 'done'
): SpichlerzEntry {
	const current = getSpichlerzEntry(entryId);
	if (!current) throw new Error(`Wpis ${entryId} nie istnieje w Spichlerzu`);
	if (taskIndex < 0 || taskIndex >= current.action_items.length) {
		throw new Error(`Nieprawidłowy indeks zadania: ${taskIndex}`);
	}

	const items = current.action_items.map((item, idx) => {
		if (idx !== taskIndex) return { ...item };
		const nextStatus = newStatus ?? (item.status === 'done' ? 'pending' : 'done');
		const updated: ActionItem = {
			...item,
			status: nextStatus
		};
		if (nextStatus === 'done') {
			updated.completed_at = new Date().toISOString().slice(0, 10);
		} else {
			delete updated.completed_at;
		}
		return updated;
	});

	return updateSpichlerzEntry(entryId, { action_items: items });
}

export function addSpichlerzTask(
	entryId: number,
	taskInput: { task: string; assignee?: string; due_date?: string }
): SpichlerzEntry {
	const current = getSpichlerzEntry(entryId);
	if (!current) throw new Error(`Wpis ${entryId} nie istnieje w Spichlerzu`);
	if (!taskInput.task?.trim()) throw new Error('Opis zadania jest wymagany');

	const newTask: ActionItem = {
		id: crypto.randomUUID(),
		task: taskInput.task.trim(),
		assignee: taskInput.assignee?.trim() || undefined,
		due_date: taskInput.due_date?.trim() || undefined,
		status: 'pending'
	};

	return updateSpichlerzEntry(entryId, {
		action_items: [...current.action_items, newTask]
	});
}

const BACKLOG_TITLE = 'Podręczny rejestr zadań (Backlog)';

export function quickCapture(input: {
	text: string;
	mode?: 'task' | 'note';
	category?: MeetingCategory;
	assignee?: string;
	due_date?: string;
	tags?: string;
	created_by?: string;
}): SpichlerzEntry {
	const text = input.text?.trim();
	if (!text) throw new Error('Treść zrzutu myśli / zadania jest wymagana');

	if (input.mode === 'note') {
		const firstLine = text.split('\n')[0].replace(/^#+\s*/, '').trim();
		const title = firstLine.length > 72 ? firstLine.slice(0, 69) + '…' : firstLine || 'Szybka notatka';
		return createSpichlerzEntry({
			title,
			category: input.category ?? 'general',
			color_tag: 'amber',
			attendees: input.created_by || 'Notatka własna',
			summary: text.slice(0, 180),
			body: text,
			tags: input.tags || null,
			created_by: input.created_by || 'admin'
		});
	}

	const newTask: ActionItem = {
		id: crypto.randomUUID(),
		task: text,
		assignee: input.assignee?.trim() || undefined,
		due_date: input.due_date?.trim() || undefined,
		status: 'pending'
	};

	const backlog = db
		.prepare('SELECT id, action_items_json FROM meeting_minutes WHERE title = ? LIMIT 1')
		.get(BACKLOG_TITLE) as { id: number; action_items_json: string } | undefined;

	if (!backlog) {
		return createSpichlerzEntry({
			title: BACKLOG_TITLE,
			category: 'operational',
			is_pinned: true,
			color_tag: 'amber',
			attendees: input.created_by || 'Zespół',
			summary: 'Bieżące zadania, linki i materiały odłożone do realizacji lub analizy.',
			body: '## Podręczny rejestr zadań\n\nZbiór szybkich zadań operacyjnych, linków do mediów i spraw do załatwienia.',
			action_items: [newTask],
			created_by: input.created_by || 'admin'
		});
	}

	let items: ActionItem[] = [];
	try {
		const parsed: ActionItem[] = JSON.parse(backlog.action_items_json || '[]');
		// Pin legacy ids before inserting at the front, so existing tasks keep the id the UI already knows.
		items = parsed.map((it, idx) => ({ ...it, id: it.id ?? `legacy-${backlog.id}-${idx}` }));
	} catch {
		items = [];
	}
	items.unshift(newTask);
	return updateSpichlerzEntry(backlog.id, { action_items: items });
}

export function listSpichlerzTags(): { tag: string; count: number }[] {
	const rows = db
		.prepare("SELECT tags FROM meeting_minutes WHERE tags IS NOT NULL AND trim(tags) != ''")
		.all() as { tags: string }[];
	const counts = new Map<string, number>();
	for (const r of rows) {
		for (const raw of r.tags.split(',')) {
			const tag = raw.trim().toLowerCase();
			if (!tag) continue;
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}

	// Add canonical tags from correspondence letters
	const letterCount = (db.prepare('SELECT COUNT(*) AS c FROM correspondence_letters').get() as { c: number }).c;
	if (letterCount > 0) {
		counts.set('braun', (counts.get('braun') ?? 0) + letterCount);
		counts.set('korona', (counts.get('korona') ?? 0) + letterCount);
		counts.set('listy', letterCount);
		counts.set('polemika', letterCount);
	}

	return [...counts.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// Legacy / alias exports for backward compatibility with meetings.ts consumers
export const listMeetings = listSpichlerzEntries;
export const getMeeting = getSpichlerzEntry;
export const createMeeting = createSpichlerzEntry;
export const updateMeeting = updateSpichlerzEntry;
export const deleteMeeting = deleteSpichlerzEntry;
export const toggleActionItem = toggleSpichlerzTask;

export function listMeetingsForThread(threadId: number): SpichlerzEntry[] {
	return listSpichlerzEntries({ thread_id: threadId });
}
