import { describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { MediaError, createMedia, getMedia, setMediaStatus, updateMedia, validateMedia, type MediaInput } from '$lib/server/media';
import { SEED_MEDIA } from '$lib/server/seed/mediaSeed';
import { human, system } from '$lib/server/review';

// ROBOT-10 — The Lyrics & Attribution Gate (docs/17_Robots/ROBOT-10-lyrics-attribution-gate.md).
// A robot cannot hear audio, so it does not claim lyrics match a recording: it enforces who decided what.
// Do not weaken an assertion to make it pass.

const alice = human('alice');
let n = 0;
const base = (over: Partial<MediaInput> = {}): MediaInput => ({
	title: 'T',
	artist_or_author: 'A',
	media_type: 'music',
	url: `https://www.youtube.com/watch?v=CCCCCCC${String(1000 + n++).padStart(4, '0')}`,
	...over
});

describe('ROBOT-10 · transparent credit', () => {
	it('SABOTAGE FIXTURE: an AI-assisted work with no named tools is rejected, in code and in the database', () => {
		expect(validateMedia(base({ ai_assisted: true })).join(' ')).toMatch(/AI tools/);
		expect(validateMedia(base({ ai_assisted: true, production_credits: '   ' })).join(' ')).toMatch(/AI tools/);
		expect(() => createMedia(base({ ai_assisted: true }), alice)).toThrow(MediaError);
		const id = createMedia(base(), alice);
		expect(() => db.prepare('UPDATE media_assets SET ai_assisted = 1 WHERE id = ?').run(id)).toThrow(/CHECK/);
	});

	it('an AI-assisted work with credits is accepted', () => {
		expect(validateMedia(base({ ai_assisted: true, production_credits: 'Suno AI' }))).toEqual([]);
	});

	it('every seeded AI-assisted track names its tools', () => {
		for (const s of SEED_MEDIA) if (s.ai_assisted) expect(s.production_credits, s.title).toMatch(/\S{3}/);
	});
});

describe('ROBOT-10 · lyrics are stored only when a human cleared them', () => {
	it('SABOTAGE FIXTURES: lyrics without a clearance decision or without licence terms are rejected, in code and in the database', () => {
		expect(validateMedia(base({ lyrics_or_transcript: 'text' })).join(' ')).toMatch(/cleared/);
		expect(validateMedia(base({ lyrics_or_transcript: 'text', lyrics_cleared_to_store: true })).join(' ')).toMatch(/licence/);
		const id = createMedia(base(), alice);
		expect(() => db.prepare("UPDATE media_assets SET lyrics_or_transcript = 'x' WHERE id = ?").run(id)).toThrow(/CHECK/);
	});

	it('no seed row stores lyrics without a licence', () => {
		for (const s of SEED_MEDIA) if (s.lyrics_or_transcript) expect(s.lyrics_license, s.title).toBeTruthy();
	});
});

describe('ROBOT-10 · only a human approves, and an edit withdraws the approval', () => {
	it('the pipeline cannot approve; a human can; the approver is recorded', () => {
		const id = createMedia(base(), alice);
		expect(() => setMediaStatus(id, 'human_approved', system('pipeline'))).toThrow(MediaError);
		setMediaStatus(id, 'human_approved', alice);
		expect(getMedia(id)).toMatchObject({ status: 'human_approved', reviewed_by: 'alice' });
	});

	it('new assets, including seeds, always start as drafts', () => {
		expect(getMedia(createMedia(base(), system('seed')))!.status).toBe('draft');
	});

	it('changing the credits or lyrics of an approved asset sends it back to draft', () => {
		const input = base({ ai_assisted: true, production_credits: 'Suno AI' });
		const id = createMedia(input, alice);
		setMediaStatus(id, 'human_approved', alice);
		const url = getMedia(id)!.url;
		updateMedia(id, { ...input, url, production_credits: 'Suno AI and a human vocalist' }, alice);
		expect(getMedia(id)!.status).toBe('draft');
	});
});
