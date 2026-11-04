import { describe, expect, it } from 'vitest';
import { readingMinutes } from './reading-time';

describe('readingMinutes', () => {
	it('is at least one minute, even for an empty text', () => {
		expect(readingMinutes('')).toBe(1);
		expect(readingMinutes('kilka słów')).toBe(1);
	});
	it('counts about 200 words a minute', () => {
		expect(readingMinutes('słowo '.repeat(2000))).toBe(10);
	});
});
