import { describe, expect, it, vi } from 'vitest';
import { localISODate, today } from './today.svelte';

describe('today', () => {
	it('formats the local calendar date', () => {
		expect(localISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
	});

	it('follows the clock instead of freezing at load', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 10, 4, 23, 59));
		expect(today.value).toBe('2026-11-04');
		vi.setSystemTime(new Date(2026, 10, 5, 0, 1));
		expect(today.value).toBe('2026-11-05');
		vi.useRealTimers();
	});
});
