import { describe, expect, it } from 'vitest';
import { db } from './db';
import {
	createSpichlerzEntry,
	getSpichlerzEntry,
	listSpichlerzEntries,
	togglePin,
	setColorTag,
	toggleSpichlerzTask,
	addSpichlerzTask,
	quickCapture,
	listSpichlerzTags,
	deleteSpichlerzEntry
} from './spichlerz';

describe('Spichlerz — Sovereign Second Brain & Deliberation Granary (Phase 10)', () => {
	it('sorts pinned entries first and toggles pin & color tag', () => {
		const olderPinned = createSpichlerzEntry({
			meeting_date: '2026-10-01',
			title: 'Przypięta doktryna spichlerza',
			category: 'doctrine',
			is_pinned: true,
			color_tag: 'emerald',
			body: 'Komórkowość gospodarcza i bezpieczeństwo żywnościowe.'
		});

		const newerUnpinned = createSpichlerzEntry({
			meeting_date: '2026-11-01',
			title: 'Zwykła notatka operacyjna',
			category: 'operational',
			is_pinned: false,
			color_tag: 'zinc',
			body: 'Bieżące ustalenia techniczne.'
		});

		const list = listSpichlerzEntries();
		const idxPinned = list.findIndex((e) => e.id === olderPinned.id);
		const idxUnpinned = list.findIndex((e) => e.id === newerUnpinned.id);
		expect(idxPinned).toBeLessThan(idxUnpinned);
		expect(olderPinned.is_pinned).toBe(true);
		expect(olderPinned.color_tag).toBe('emerald');

		const unpinned = togglePin(olderPinned.id);
		expect(unpinned.is_pinned).toBe(false);

		const recolored = setColorTag(newerUnpinned.id, 'rose');
		expect(recolored.color_tag).toBe('rose');
	});

	it('indexes and searches inside action_items_json and agenda via FTS5', () => {
		const entry = createSpichlerzEntry({
			title: 'Plan wydawniczy jesień',
			category: 'campaign',
			agenda: 'Omówienie plakatu z żubrem i szerszeniem',
			body: 'Przygotowanie materiałów graficznych.',
			action_items: [
				{
					task: 'Skontaktować się z drukarnią offsetową w Krakowie (ul. Karmelicka)',
					assignee: 'BZ',
					status: 'pending'
				}
			]
		});

		// Search for a word that ONLY appears inside action_items_json
		const byTask = listSpichlerzEntries({ q: 'offsetową Krakowie' });
		expect(byTask.some((e) => e.id === entry.id)).toBe(true);

		// Search without Polish diacritics
		const byTaskAscii = listSpichlerzEntries({ q: 'offsetowa' });
		expect(byTaskAscii.some((e) => e.id === entry.id)).toBe(true);

		// Search for a word that ONLY appears in agenda
		const byAgenda = listSpichlerzEntries({ q: 'szerszeniem' });
		expect(byAgenda.some((e) => e.id === entry.id)).toBe(true);
	});

	it('links entries to media_assets, sources, and resolves kuznia_id', () => {
		const mediaId = Number(
			db
				.prepare(
					`INSERT INTO media_assets (slug, title, artist_or_author, media_type, genre, platform, external_id, url, embed_url, created_by)
					 VALUES ('niemen-dziwny', 'Dziwny jest ten świat', 'Czesław Niemen', 'music', 'rock_metal', 'youtube', 'wTjLZwpmufw', 'https://youtube.com/watch?v=wTjLZwpmufw', 'https://www.youtube-nocookie.com/embed/wTjLZwpmufw', 'admin')`
				)
				.run().lastInsertRowid
		);

		const kuzniaId = Number(
			db
				.prepare(
					`INSERT INTO kuznia_deliberations (item_type, media_id, title, theological_notes)
					 VALUES ('media', ?, 'Analiza Niemena', 'Człowiek dobrej woli')`
				)
				.run(mediaId).lastInsertRowid
		);

		const entry = createSpichlerzEntry({
			title: 'Notatka z odsłuchu Niemena',
			category: 'doctrine',
			media_id: mediaId,
			color_tag: 'amber',
			body: 'Ludzi dobrej woli jest więcej.'
		});

		const loaded = getSpichlerzEntry(entry.id);
		expect(loaded?.media_id).toBe(mediaId);
		expect(loaded?.media_title).toBe('Dziwny jest ten świat');
		expect(loaded?.media_artist).toBe('Czesław Niemen');
		expect(loaded?.kuznia_id).toBe(kuzniaId);
	});

	it('toggles action items and records completed_at date', () => {
		const entry = createSpichlerzEntry({
			title: 'Lista kontrolna',
			body: 'Zadania testowe',
			action_items: [{ task: 'Zweryfikować V Konwencję Haską', status: 'pending' }]
		});

		const withSecond = addSpichlerzTask(entry.id, {
			task: 'Przygotować korektę listu',
			assignee: 'BZ',
			due_date: '2026-11-10'
		});
		expect(withSecond.action_items).toHaveLength(2);

		const done = toggleSpichlerzTask(entry.id, 0);
		expect(done.action_items[0].status).toBe('done');
		expect(done.action_items[0].completed_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);

		const reopened = toggleSpichlerzTask(entry.id, 0);
		expect(reopened.action_items[0].status).toBe('pending');
		expect(reopened.action_items[0].completed_at).toBeUndefined();
	});

	it('supports quickCapture in both task (Backlog) and note modes, and aggregates tags', () => {
		const backlog = quickCapture({
			text: 'Przeczytać memoriał o retencji wodnej',
			mode: 'task',
			assignee: 'Zespół',
			due_date: '2026-11-15'
		});
		expect(backlog.title).toBe('Podręczny rejestr zadań (Backlog)');
		expect(backlog.is_pinned).toBe(true);
		expect(backlog.action_items[0].task).toBe('Przeczytać memoriał o retencji wodnej');

		const note = quickCapture({
			text: '# Szybka myśl o suwerenności\nSpichlerz gromadzi ziarno na czas próby.',
			mode: 'note',
			category: 'strategy',
			tags: 'spichlerz, ziarno, strategia'
		});
		expect(note.title).toBe('Szybka myśl o suwerenności');
		expect(note.category).toBe('strategy');

		const tags = listSpichlerzTags();
		expect(tags.some((t) => t.tag === 'spichlerz' && t.count >= 1)).toBe(true);

		expect(deleteSpichlerzEntry(note.id)).toBe(true);
	});

	it('ingests and searches correspondence letters to Grzegorz Braun and replies from his office', () => {
		const threadId = Number(
			db
				.prepare(
					`INSERT INTO correspondence_threads (slug, title, interlocutor, organization, methodology)
					 VALUES ('korona', 'Polemika z Koroną (Grzegorz Braun)', 'Grzegorz Braun, Teresa Pracownik', 'KKP', 'thomistic_disputation')`
				)
				.run().lastInsertRowid
		);

		db.prepare(
			`INSERT INTO correspondence_letters (thread_id, turn_number, direction, sender, recipient, date_label, filename, summary_pl, summary_en, body, key_claims_json)
			 VALUES (?, 8, 'inbound', 'Teresa Pracownik (Biuro Poselskie KKP)', 'Bogdan Zięba', '14 X 2026', 'korona_odp_04.txt', 'Odpowiedź IV: Obrona Sanacji i nie trzeba wybierać między lemieszem a mieczem', 'Reply IV', 'Tekst odpowiedzi biura poselskiego posła Brauna...', '["Nie trzeba wybierać między lemieszem a mieczem"]')`
		).run(threadId);

		db.prepare(
			`INSERT INTO correspondence_letters (thread_id, turn_number, direction, sender, recipient, date_label, filename, summary_pl, summary_en, body, key_claims_json)
			 VALUES (?, 9, 'outbound', 'Bogdan Zięba (Przymierze Lemiesza)', 'Poseł Grzegorz Braun', '18 X 2026', 'lemiesz_to_korona_05.txt', 'List V: Zbrojna Neutralność, Stal i Powołanie, Lubmin 2027', 'Letter V', 'Panie Pośle, Lubmin 2027 to dziejowa szansa...', '["Lemiesz i miecz to ta sama stal"]')`
		).run(threadId);

		const epistolary = listSpichlerzEntries({ category: 'epistolary' });
		expect(epistolary.length).toBeGreaterThanOrEqual(2);

		const list5 = epistolary.find((e) => e.entry_type === 'letter' && e.letter_turn === 9);
		expect(list5).toBeDefined();
		expect(list5?.title).toContain('List V (do Grzegorza Brauna)');
		expect(list5?.is_pinned).toBe(true);
		expect(list5?.color_tag).toBe('purple');

		const odp4 = epistolary.find((e) => e.entry_type === 'letter' && e.letter_turn === 8);
		expect(odp4).toBeDefined();
		expect(odp4?.title).toContain('Odpowiedź IV (Biuro Poselskie G. Brauna');
		expect(odp4?.color_tag).toBe('blue');

		// Query by uid string (e.g. l-...)
		const fetchedByUid = getSpichlerzEntry(list5!.uid);
		expect(fetchedByUid?.id).toBe(list5?.id);
		expect(fetchedByUid?.entry_type).toBe('letter');
		expect(fetchedByUid?.key_claims?.length).toBeGreaterThan(0);

		// Search across letters via q
		const searchLubmin = listSpichlerzEntries({ q: 'Lubmin' });
		expect(searchLubmin.some((e) => e.entry_type === 'letter')).toBe(true);

		// Tag matching for braun / korona
		const byTag = listSpichlerzEntries({ tag: 'braun' });
		expect(byTag.some((e) => e.entry_type === 'letter')).toBe(true);
	});
});
