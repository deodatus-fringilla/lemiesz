import { describe, expect, it } from 'vitest';
import { getTranscript, listTranscripts } from './transcripts';

describe('transcripts intake service (corpus/intake)', () => {
	it('lists raw transcripts and dossiers from corpus/intake while excluding Korona letters', () => {
		const { transcripts, folders } = listTranscripts();
		expect(transcripts.length).toBeGreaterThan(0);
		expect(folders.some((f) => f.name === 'for_processing')).toBe(true);
		expect(transcripts.some((t) => t.slug.includes('Nawrocki'))).toBe(true);
		expect(transcripts.some((t) => t.slug.startsWith('letters_archive/Korona'))).toBe(false);
	});

	it('filters transcripts by search query and folder', () => {
		const { transcripts } = listTranscripts({ search: 'ONZ', folder: 'letters_archive/Prezydent/Nawrocki' });
		expect(transcripts.length).toBe(1);
		expect(transcripts[0].wordCount).toBeGreaterThan(1000);
	});

	it('loads a transcript with rendered HTML and rejects path traversal', () => {
		const detail = getTranscript('letters_archive/Prezydent/Nawrocki/2026-09-23_ONZ_81_sesja_wystapienie.md');
		expect(detail).not.toBeNull();
		expect(detail?.html).toContain('<h1>');
		expect(getTranscript('../../package.json')).toBeNull();
	});
});
