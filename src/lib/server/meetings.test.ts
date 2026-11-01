import { describe, expect, it } from 'vitest';
import { db } from './db';
import {
	createMeeting,
	getMeeting,
	listMeetings,
	updateMeeting,
	deleteMeeting,
	toggleActionItem,
	type MeetingInput
} from './meetings';

describe('Meeting Minutes & Deliberations (Phase 8)', () => {
	it('creates and retrieves a stand-alone meeting minute', () => {
		const input: MeetingInput = {
			meeting_date: '2026-11-01',
			title: 'Narada programowa: Doktryna Jeża',
			category: 'strategy',
			attendees: 'Bogdan Zięba, Zespół Strategiczny',
			agenda: '1. Retencja wód\n2. Schrony 100%\n3. Komunikacja',
			summary: 'Ustalono priorytety programowe obrony powszechnej.',
			body: '## Ustalenia doktrynalne\n\nNiedźwiedź omija jeża nie z miłości, ale ze strachu przed połamaniem zębów.',
			tags: 'jeż, strategia, obrona',
			action_items: [
				{ task: 'Przygotować briefing o małej retencji', assignee: 'BZ', due_date: '2026-11-10', status: 'pending' },
				{ task: 'Weryfikacja norm szwajcarskich dla schronów', assignee: 'Tech', status: 'pending' }
			]
		};

		const created = createMeeting(input);
		expect(created.id).toBeGreaterThan(0);
		expect(created.title).toBe(input.title);
		expect(created.category).toBe('strategy');
		expect(created.action_items).toHaveLength(2);
		expect(created.action_items[0].status).toBe('pending');

		const fetched = getMeeting(created.id);
		expect(fetched).not.toBeNull();
		expect(fetched?.title).toBe(input.title);
		expect(fetched?.attendees).toBe(input.attendees);
		expect(fetched?.action_items).toHaveLength(2);
	});

	it('creates a meeting minute linked to an epistolary thread', () => {
		const threadId = Number(
			db
				.prepare("INSERT INTO correspondence_threads (slug, title, interlocutor, organization) VALUES ('test-korona', 'Polemika Test', 'Teresa P.', 'KKP')")
				.run().lastInsertRowid
		);

		const created = createMeeting({
			meeting_date: '2026-11-01',
			title: 'Analiza milczenia po Liście V',
			category: 'epistolary',
			thread_id: threadId,
			attendees: 'Bogdan Zięba',
			summary: 'Biuro milczy już 14 dni.',
			body: 'Szach retoryczny.',
			action_items: [{ task: 'Monit', status: 'pending' }]
		});

		expect(created.thread_id).toBe(threadId);
		expect(created.thread_title).toBe('Polemika Test');
		expect(created.thread_slug).toBe('test-korona');

		const list = listMeetings({ thread_id: threadId });
		expect(list.some((m) => m.id === created.id)).toBe(true);
	});

	it('updates meeting and toggles action item status', () => {
		const created = createMeeting({
			title: 'Do aktualizacji',
			category: 'operational',
			attendees: 'Admin',
			summary: 'Krótki opis',
			body: 'Treść',
			action_items: [
				{ task: 'Zadanie A', status: 'pending' },
				{ task: 'Zadanie B', status: 'pending' }
			]
		});

		const toggled = toggleActionItem(created.id, 0);
		expect(toggled.action_items[0].status).toBe('done');
		expect(toggled.action_items[1].status).toBe('pending');

		const toggledAgain = toggleActionItem(created.id, 0);
		expect(toggledAgain.action_items[0].status).toBe('pending');

		const updated = updateMeeting(created.id, { title: 'Zaktualizowany tytuł' });
		expect(updated.title).toBe('Zaktualizowany tytuł');
	});

	it('searches meetings using full-text search', () => {
		createMeeting({
			title: 'Dysputa o V Konwencji Haskiej',
			category: 'doctrine',
			attendees: 'Bogdan Zięba',
			summary: 'Neutralność w prawie międzynarodowym od 1907 roku.',
			body: 'V Konwencja Haska gwarantuje nietykalność terytorium państwa neutralnego.',
			tags: 'haga, prawo, neutralnosc'
		});

		const results = listMeetings({ q: 'Haskiej' });
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].title).toContain('Haskiej');

		const empty = listMeetings({ q: 'nieistniejaceslowokluczowe12345' });
		expect(empty).toHaveLength(0);
	});

	it('deletes a meeting', () => {
		const created = createMeeting({
			title: 'Do skasowania',
			category: 'general',
			attendees: 'Admin',
			summary: 'Test kasowania',
			body: 'Treść'
		});

		expect(deleteMeeting(created.id)).toBe(true);
		expect(getMeeting(created.id)).toBeNull();
	});
});
