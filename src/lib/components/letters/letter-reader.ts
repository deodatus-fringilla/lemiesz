/** Minimal letter shape the reader needs. Kept free of server imports so the component stays standalone. */
export interface ReaderLetter {
	id: number;
	thread_id: number;
	turn_number: number;
	direction: 'outbound' | 'inbound';
	sender: string;
	recipient: string;
	date_label: string;
	filename: string;
	body: string;
}

/** One spread of the book: the letter on the left page, the reply (if any) on the right. */
export interface ReaderRound {
	letter: ReaderLetter | null;
	response: ReaderLetter | null;
}

/** Pairs each outbound letter with the inbound reply that follows it. Tolerates gaps and orphan replies. */
export function buildRounds(letters: ReaderLetter[]): ReaderRound[] {
	const rounds: ReaderRound[] = [];
	for (const l of [...letters].sort((a, b) => a.turn_number - b.turn_number)) {
		const last = rounds[rounds.length - 1];
		if (l.direction === 'outbound') {
			rounds.push({ letter: l, response: null });
		} else if (last && !last.response) {
			last.response = l;
		} else {
			rounds.push({ letter: null, response: l });
		}
	}
	return rounds;
}

/** Index of the round that contains the given letter id (0 when not found). */
export function roundIndexOf(rounds: ReaderRound[], letterId: number | undefined): number {
	const i = rounds.findIndex((r) => r.letter?.id === letterId || r.response?.id === letterId);
	return i === -1 ? 0 : i;
}

/** Fetches one thread's letters for the reader; throws on failure so the caller can tell the user. */
export async function fetchThreadLetters(threadId: number, fetcher: typeof fetch = fetch): Promise<ReaderLetter[]> {
	const res = await fetcher(`/api/letters?thread_id=${threadId}`);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return ((await res.json()) as { letters: ReaderLetter[] }).letters;
}
