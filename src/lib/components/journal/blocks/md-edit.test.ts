import { describe, expect, it } from 'vitest';
import { insertAt, prefixLines, wrap } from './md-edit';

describe('Markdown toolbar edits', () => {
	it('wraps the selection and keeps it selected', () => {
		expect(wrap('Ala ma kota', 4, 6, '**', '**', 'tekst')).toEqual({ value: 'Ala **ma** kota', start: 6, end: 8 });
	});

	it('inserts a selected placeholder when nothing is selected', () => {
		const e = wrap('Ala ', 4, 4, '*', '*', 'kursywa');
		expect(e.value).toBe('Ala *kursywa*');
		expect(e.value.slice(e.start, e.end)).toBe('kursywa');
	});

	it('turns the touched lines into a list, numbered or not', () => {
		const text = 'wstęp\njeden\ndwa\nkoniec';
		expect(prefixLines(text, 8, 13, 'bullet').value).toBe('wstęp\n- jeden\n- dwa\nkoniec');
		expect(prefixLines(text, 8, 13, 'numbered').value).toBe('wstęp\n1. jeden\n2. dwa\nkoniec');
		expect(prefixLines('sam', 0, 0, 'bullet').value).toBe('- sam');
	});

	it('inserts a citation token at the cursor', () => {
		expect(insertAt('Teza.', 4, 4, ' [[src:7]]')).toEqual({ value: 'Teza [[src:7]].', start: 14, end: 14 });
	});
});
