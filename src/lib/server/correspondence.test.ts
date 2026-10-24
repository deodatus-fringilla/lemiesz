import { describe, expect, it } from 'vitest';
import { db } from './db';
import {
	classifyMethodology,
	createLetter,
	deleteLetter,
	getLetter,
	listLetters,
	nextTurn,
	updateLetter,
	validateLetter,
	type LetterInput
} from './correspondence';
import { runChecks } from './content/checks';

describe('Korona Epistolary Corpus & Classical Methodologies', () => {

	it('classifies opponent claims into the 5 non-Hegelian Classical Methodologies', () => {
		expect(classifyMethodology('Zasada Si vis pacem, para bellum i lekcja 1939 roku.')).toBe('thomistic_disputation');
		expect(classifyMethodology('Polska może być albo mocarstwem militarnym, albo zależna — nie potrzebujemy neutralności.')).toBe(
			'classical_refutation'
		);
		expect(classifyMethodology('Przy dzietności i budżecie gospodarki musimy liczyć koszty zbrojeń na kredyt.')).toBe(
			'sovereign_disputation'
		);
		expect(classifyMethodology('Zgadzam się z Panem i szanuję wspólny cel, jakim jest niebycie pionkiem.')).toBe(
			'chivalrous_polemics'
		);
	});

	it('validates epistolary letter structure in Content Engine checks', () => {
		const validLetter = [
			'Szanowna Pani Tereso, Szczęść Boże!',
			'W odpowiedzi na Pani pismo z 14 października 2026 roku pragnę zastosować klasyczne rozróżnienie tomistyczne (Distinguo) wobec tezy o Oazie Pokoju oraz Płodności Lemiesza. Państwo polskie potrzebuje suwerenności pokoju zakorzenionej w Rachunku Królewskim z Ewangelii według św. Łukasza, a nie zadłużonego garnizonu kupowanego na kredyt bez kodów źródłowych.',
			'Zestawienie doświadczenia Austrii z 1955 roku oraz Konstytucji Malty dowodzi jednoznacznie, że neutralność terytorialna nie jest kapitulacją, lecz suwerenną architekturą bezpieczeństwa.',
			'Z wyrazami szacunku, Bogdan Zięba (Przymierze Lemiesza)'
		].join('\n\n');

		const checks = runChecks({ platform: 'letter', body: validLetter, sourceTexts: [], brief: validLetter });
		const structCheck = checks.find((c) => c.id === 'letter_structure');
		expect(structCheck?.ok).toBe(true);
	});
});

describe('letters entered in the app (Spichlerz, corpus proposal v3.1 phase 3)', () => {
	const threadId = Number(
		db
			.prepare("INSERT INTO correspondence_threads (slug, title, interlocutor, organization) VALUES ('test-thread', 'Test', 'Pani X', 'Org')")
			.run().lastInsertRowid
	);
	const body = [
		'Szczęść Boże!',
		'Neutralność zbrojna nie jest bezbronnością: to suwerenna decyzja państwa, które nie bierze udziału w cudzych wojnach i strzeże własnej ziemi.',
		'Z wyrazami szacunku'
	].join('\n\n');
	const letter = (over: Partial<LetterInput> = {}): LetterInput => ({
		thread_id: threadId,
		turn_number: nextTurn(threadId),
		direction: 'outbound',
		sender: 'A',
		recipient: 'B',
		date_label: '1 XI 2026',
		filename: 'test_01.txt',
		summary_pl: 'Streszczenie',
		summary_en: 'Summary',
		body,
		...over
	});

	it('adds a letter at the next turn and extracts its key claims from the text', () => {
		expect(nextTurn(threadId)).toBe(1);
		const id = createLetter(letter());
		const saved = getLetter(id)!;
		expect(saved).toMatchObject({ turn_number: 1, thread_slug: 'test-thread', filename: 'test_01.txt' });
		expect(saved.key_claims).toEqual([expect.stringMatching(/^Neutralność zbrojna/)]);
		expect(nextTurn(threadId)).toBe(2);
		expect(listLetters({ threadId }).map((l) => l.id)).toEqual([id]);
		expect(listLetters({ search: 'cudzych wojnach' }).map((l) => l.id)).toEqual([id]);
	});

	it('refuses an incomplete letter, an unknown thread and a file name another letter uses', () => {
		const incomplete = validateLetter({ ...letter(), body: '  ', sender: '' });
		expect(incomplete).toEqual(expect.arrayContaining(['Sender is required', 'Letter text is required']));
		expect(validateLetter(letter({ thread_id: 99999 })).join(' ')).toMatch(/thread/);
		expect(validateLetter(letter({ filename: '../evil.txt' })).join(' ')).toMatch(/File name/);
		expect(() => createLetter(letter({ filename: 'test_01.txt' }))).toThrow(/already used/);
	});

	it('edits a letter in place (its own file name is not a clash) and re-extracts the claims; deletes it', () => {
		const id = createLetter(letter({ filename: 'test_02.txt' }));
		updateLetter(id, letter({ filename: 'test_02.txt', turn_number: 2, body: body + '\n\nDruga, nowa i wystarczająco długa teza o pokoju, sprawiedliwości i suwerenności narodu polskiego.' }));
		const saved = getLetter(id)!;
		expect(saved.turn_number).toBe(2);
		expect(saved.key_claims).toHaveLength(2);
		expect(deleteLetter(id)).toBe(true);
		expect(getLetter(id)).toBeNull();
	});
});
