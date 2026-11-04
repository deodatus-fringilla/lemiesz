import { describe, expect, it } from 'vitest';
import { buildRounds, roundIndexOf, type ReaderLetter } from './letter-reader';

const L = (id: number, turn: number, direction: 'outbound' | 'inbound'): ReaderLetter => ({
	id, thread_id: 1, turn_number: turn, direction, sender: 'a', recipient: 'b', date_label: 'd', filename: 'f', body: 'x'
});

describe('buildRounds', () => {
	it('pairs each outbound letter with the reply that follows it', () => {
		const rounds = buildRounds([L(4, 4, 'inbound'), L(1, 1, 'outbound'), L(2, 2, 'inbound'), L(3, 3, 'outbound')]);
		expect(rounds.map((r) => [r.letter?.id, r.response?.id])).toEqual([[1, 2], [3, 4]]);
	});

	it('leaves the response empty while a letter is unanswered', () => {
		const rounds = buildRounds([L(1, 1, 'outbound'), L(2, 2, 'inbound'), L(3, 3, 'outbound')]);
		expect(rounds[1]).toEqual({ letter: expect.objectContaining({ id: 3 }), response: null });
	});

	it('keeps an orphan reply on its own spread', () => {
		expect(buildRounds([L(2, 2, 'inbound')])).toEqual([{ letter: null, response: expect.objectContaining({ id: 2 }) }]);
	});

	it('finds the round containing a letter, from either side', () => {
		const rounds = buildRounds([L(1, 1, 'outbound'), L(2, 2, 'inbound'), L(3, 3, 'outbound'), L(4, 4, 'inbound')]);
		expect(roundIndexOf(rounds, 4)).toBe(1);
		expect(roundIndexOf(rounds, 1)).toBe(0);
		expect(roundIndexOf(rounds, 999)).toBe(0);
	});
});
