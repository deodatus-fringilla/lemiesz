import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { LOCALES, DEFAULT_LOCALE, ORIGINAL_ONLY, ftsTable, isLocale, isStorableLocale } from './locales';

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

describe('Locale registry', () => {
	it('has Polish as the default locale', () => {
		expect(DEFAULT_LOCALE).toBe('pl');
		expect(LOCALES).toHaveProperty('pl');
	});

	it('distinguishes UI locales from original-only languages', () => {
		expect(isLocale('pl')).toBe(true);
		expect(isLocale('fr')).toBe(false);
		expect(isStorableLocale('fr')).toBe(true);
		expect(isStorableLocale('xx')).toBe(false);
		expect(ORIGINAL_ONLY).toContain('la');
	});

	it('only builds FTS table names for registered locales', () => {
		expect(ftsTable('pl')).toBe('fts_pl');
		// @ts-expect-error deliberately invalid: must never reach SQL
		expect(() => ftsTable("pl; DROP TABLE sources")).toThrow();
	});
});

describe('i18n consistency', () => {
	const settings = readJson('project.inlang/settings.json');
	const codes = Object.keys(LOCALES).sort();

	it('inlang project locales match the registry', () => {
		expect([...settings.locales].sort()).toEqual(codes);
		expect(settings.baseLocale).toBe(DEFAULT_LOCALE);
	});

	it('every message key exists in every locale (key parity)', () => {
		const keys = (code: string) =>
			Object.keys(readJson(`messages/${code}.json`))
				.filter((k) => !k.startsWith('$'))
				.sort();
		const base = keys(DEFAULT_LOCALE);
		expect(base.length).toBeGreaterThan(20);
		for (const code of codes) expect(keys(code), `messages/${code}.json`).toEqual(base);
	});
});
