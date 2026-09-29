import { describe, it, expect } from 'vitest';
import { LOCALES, DEFAULT_LOCALE, ORIGINAL_ONLY } from './locales';

describe('Locale Registry', () => {
	it('has Polish as the default locale', () => {
		expect(DEFAULT_LOCALE).toBe('pl');
		expect(LOCALES).toHaveProperty('pl');
	});

	it('configures English with porter stemmer', () => {
		expect(LOCALES.en.stemMode).toBe('porter');
		expect(LOCALES.en.minPrefix).toBe(3);
	});

	it('configures Polish with minPrefix of 4 for inflection safety', () => {
		expect(LOCALES.pl.minPrefix).toBe(4);
		expect(LOCALES.pl.stemMode).toBe('keywords');
	});

	it('includes original-only languages for canonical storage', () => {
		expect(ORIGINAL_ONLY).toContain('la');
		expect(ORIGINAL_ONLY).toContain('de');
		expect(ORIGINAL_ONLY).toContain('fr');
		expect(ORIGINAL_ONLY).toContain('it');
	});
});
