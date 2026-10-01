import { describe, expect, it } from 'vitest';
import { db } from './db';
import { FakeLlm } from './llm/fake';
import { human, system } from './review';
import { makeArgument, makeSource } from './testing';
import { CitationStreamer } from './shield/cite';
import { runContent, type ContentEvent } from './content/generate';
import { getDraft } from './content/drafts';
import {
	MediaError,
	createMedia,
	getMedia,
	isAllowedEmbed,
	linkMedia,
	linksForMedia,
	listMedia,
	mediaForContent,
	parseMediaUrl,
	renderMediaReference,
	setMediaStatus,
	updateMedia,
	deleteMedia,
	type MediaInput
} from './media';
import { SEED_MEDIA, seedMedia } from './seed/mediaSeed';

const alice = human('alice');
let n = 0;
const ytId = () => `AAAAAAA${String(1000 + n++).padStart(4, '0')}`; // 11 chars
const input = (over: Partial<MediaInput> = {}): MediaInput => ({
	title: `Song ${n}`,
	artist_or_author: 'Some Artist',
	media_type: 'music',
	genre: 'modern_synth',
	url: `https://www.youtube.com/watch?v=${ytId()}`,
	...over
});
const make = (over: Partial<MediaInput> = {}, approve = false) => {
	const id = createMedia(input(over), alice);
	if (approve) setMediaStatus(id, 'human_approved', alice);
	return id;
};

describe('parseMediaUrl', () => {
	it('canonicalises YouTube links, drops list/tracking parameters and uses the no-cookie embed', () => {
		const r = parseMediaUrl('https://www.youtube.com/watch?v=URYM2FITucQ&list=OLAK5uy_lqIlvkTo4YeyNtOIJfYXg2RE_EKE0o46U&index=1')!;
		expect(r).toEqual({
			platform: 'youtube',
			external_id: 'URYM2FITucQ',
			url: 'https://www.youtube.com/watch?v=URYM2FITucQ',
			embed_url: 'https://www.youtube-nocookie.com/embed/URYM2FITucQ'
		});
		expect(parseMediaUrl('https://youtu.be/URYM2FITucQ?si=track')!.external_id).toBe('URYM2FITucQ');
		expect(parseMediaUrl('https://www.youtube.com/shorts/URYM2FITucQ')!.external_id).toBe('URYM2FITucQ');
	});

	it('accepts Spotify items and rejects every other host, scheme or malformed id', () => {
		const sp = parseMediaUrl('https://open.spotify.com/intl-pl/track/4uLU6hMCjMI75M1A2tKUQC?si=x')!;
		expect(sp.embed_url).toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
		for (const bad of [
			'https://evil.example/watch?v=URYM2FITucQ',
			'https://www.youtube.com.evil.example/watch?v=URYM2FITucQ',
			'javascript:alert(1)',
			'https://www.youtube.com/watch?v=short',
			'https://open.spotify.com/track/not-an-id',
			'not a url'
		]) {
			expect(parseMediaUrl(bad), bad).toBeNull();
		}
	});

	it('allows only the two privacy-respecting embed hosts', () => {
		expect(isAllowedEmbed('https://www.youtube-nocookie.com/embed/URYM2FITucQ')).toBe(true);
		expect(isAllowedEmbed('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC')).toBe(true);
		expect(isAllowedEmbed('https://www.youtube.com/embed/URYM2FITucQ')).toBe(false);
		expect(isAllowedEmbed('http://www.youtube-nocookie.com/embed/URYM2FITucQ')).toBe(false);
	});
});

describe('media assets: creation and review rules', () => {
	it('always creates a draft, with the embed derived from the link', () => {
		const id = make();
		const m = getMedia(id)!;
		expect(m.status).toBe('draft');
		expect(m.embed_url.startsWith('https://www.youtube-nocookie.com/embed/')).toBe(true);
		expect(m.reviewed_by).toBeNull();
	});

	it('rejects a duplicate link and a link that is not YouTube or Spotify', () => {
		const url = `https://www.youtube.com/watch?v=${ytId()}`;
		createMedia(input({ url }), alice);
		expect(() => createMedia(input({ url }), alice)).toThrow(/already/);
		expect(() => createMedia(input({ url: 'https://vimeo.com/123' }), alice)).toThrow(MediaError);
	});

	it('only a human may approve; the pipeline and system actors may not', () => {
		const id = make();
		expect(() => setMediaStatus(id, 'human_approved', system('pipeline'))).toThrow(MediaError);
		expect(getMedia(id)!.status).toBe('draft');
		setMediaStatus(id, 'human_approved', alice);
		const m = getMedia(id)!;
		expect(m.status).toBe('human_approved');
		expect(m.reviewed_by).toBe('alice');
	});

	it('editing what the public sees sends an approved item back to draft; editing notes does not', () => {
		const id = make({}, true);
		const base = input({ url: getMedia(id)!.url, title: getMedia(id)!.title });
		expect(updateMedia(id, { ...base, notes: 'internal remark' }, alice)).toEqual({ changed: true, reset: false });
		expect(getMedia(id)!.status).toBe('human_approved');
		expect(updateMedia(id, { ...base, notes: 'internal remark', title: 'A different title' }, alice)).toEqual({ changed: true, reset: true });
		const m = getMedia(id)!;
		expect(m.status).toBe('draft');
		expect(m.reviewed_by).toBeNull();
	});

	it('an unchanged save changes nothing', () => {
		const id = make({ mood: 'solemn' });
		const m = getMedia(id)!;
		expect(updateMedia(id, input({ url: m.url, title: m.title, mood: 'solemn' }), alice)).toEqual({ changed: false, reset: false });
	});
});

describe('transparent credit and lyrics licensing', () => {
	it('an AI-assisted work must name its tools', () => {
		expect(() => createMedia(input({ ai_assisted: true }), alice)).toThrow(/AI tools/);
		expect(getMedia(make({ ai_assisted: true, production_credits: 'Suno AI' }))!.ai_assisted).toBe(true);
	});

	it('lyrics are stored only with a clearance decision and licence terms', () => {
		expect(() => createMedia(input({ lyrics_or_transcript: 'la la la' }), alice)).toThrow(/cleared/);
		expect(() => createMedia(input({ lyrics_or_transcript: 'la la la', lyrics_cleared_to_store: true }), alice)).toThrow(/licence/);
		const id = make({ lyrics_or_transcript: 'Jeszcze Polska nie zginęła', lyrics_cleared_to_store: true, lyrics_license: 'Public domain (text from 1797)' });
		expect(getMedia(id)!.lyrics_or_transcript).toContain('Polska');
	});

	it('the database refuses what the code would refuse (CHECK constraints are the second lock)', () => {
		const id = make();
		expect(() => db.prepare("UPDATE media_assets SET lyrics_or_transcript = 'x' WHERE id = ?").run(id)).toThrow(/CHECK/);
		expect(() => db.prepare('UPDATE media_assets SET ai_assisted = 1 WHERE id = ?').run(id)).toThrow(/CHECK/);
		expect(() => db.prepare("UPDATE media_assets SET embed_url = 'https://tracker.example/embed/x' WHERE id = ?").run(id)).toThrow(/CHECK/);
		expect(() => db.prepare("UPDATE media_assets SET embed_url = 'https://www.youtube.com/embed/AAAAAAAAAAA' WHERE id = ?").run(id)).toThrow(/CHECK/);
	});
});

describe('search and links', () => {
	it('finds titles and lyrics (diacritics ignored) and stays in sync after edit and delete', () => {
		const id = make({
			title: 'Pieśń o pokoju',
			lyrics_or_transcript: 'Zaorzemy miecze na lemiesze',
			lyrics_cleared_to_store: true,
			lyrics_license: 'Original lyrics, owner licence'
		});
		expect(listMedia({ q: 'piesn pokoju' }).map((x) => x.id)).toContain(id);
		expect(listMedia({ q: 'lemiesze' }).map((x) => x.id)).toContain(id);
		const m = getMedia(id)!;
		updateMedia(id, input({ url: m.url, title: 'Hymn bez słów', lyrics_or_transcript: 'Zaorzemy miecze na lemiesze', lyrics_cleared_to_store: true, lyrics_license: 'Original lyrics, owner licence' }), alice);
		expect(listMedia({ q: 'pokoju' }).map((x) => x.id)).not.toContain(id);
		expect(listMedia({ q: 'hymn' }).map((x) => x.id)).toContain(id);
		deleteMedia(id);
		expect(listMedia({ q: 'lemiesze' }).map((x) => x.id)).not.toContain(id);
	});

	it('is safe against FTS operators and filters by genre', () => {
		make({ genre: 'gregorian_sacred', title: 'Kyrie' });
		expect(() => listMedia({ q: 'AND OR NEAR ( " *' })).not.toThrow();
		expect(listMedia({ genre: 'gregorian_sacred' }).every((x) => x.genre === 'gregorian_sacred')).toBe(true);
	});

	it('links media to an argument with a human-written cue, and rejects a malformed cue or a non-human actor', () => {
		const a = makeArgument({ source_ids: [makeSource()] });
		const id = make();
		linkMedia(a, id, '0:45 - 1:15', null, alice);
		expect(linksForMedia(id)[0]).toMatchObject({ argument_id: a, cue: '0:45 - 1:15' });
		expect(() => linkMedia(a, id, 'at the chorus', null, alice)).toThrow(/Cue/);
		expect(() => linkMedia(a, id, '0:10', null, system('pipeline'))).toThrow(/human/);
	});
});

describe('Content Engine: only approved media, only by token', () => {
	it('offers approved media linked to the retrieved cards (with their cue), then genre matches; never drafts or flagged', () => {
		const src = makeSource({ text: 'Quartzite harbours remain inviolable during every regional emergency.' });
		const arg = makeArgument({ source_ids: [src], opponent_claim: 'Quartzite harbours inviolable emergency' });
		const linked = make({ genre: 'classical' }, true);
		const draft = make({ genre: 'modern_synth' });
		const flagged = make({ genre: 'modern_synth' }, true);
		setMediaStatus(flagged, 'flagged', alice);
		const synth = make({ genre: 'modern_synth' }, true);
		linkMedia(arg, linked, '1:00 - 1:30', null, alice);
		const ids = mediaForContent('shorts', [arg]).map((x) => x.id);
		expect(ids[0]).toBe(linked);
		expect(ids).toContain(synth);
		expect(ids).not.toContain(draft);
		expect(ids).not.toContain(flagged);
		expect(mediaForContent('shorts', [arg])[0].cue).toBe('1:00 - 1:30');
	});

	it('a [[media:ID]] token expands to database fields only; unknown or unapproved ids are stripped', () => {
		const id = make({ title: 'Iluzja testowa', artist_or_author: 'Tester' }, true);
		const draftId = make({ title: 'Secret draft' });
		const ref = (x: number) => renderMediaReference({ id: x, title: getMedia(x)!.title, artist: getMedia(x)!.artist_or_author, genre: 'modern_synth', mood: null, url: getMedia(x)!.url, cue: '0:45 - 1:15' }, 'shorts');
		const c = new CitationStreamer(new Set(), { media: new Map([[id, ref(id)]]) });
		const out = c.push(`Cue: [[media:${id}]] and [[media:${draftId}]] and [[media:99999]].`) + c.flush();
		expect(out).toBe('Cue: Iluzja testowa — Tester, 0:45 - 1:15 and  and .');
		expect(c.mediaUsed).toEqual([id]);
		expect(c.rejectedMedia).toEqual([draftId, 99999]);
	});

	it('runContent writes the title and cue from the database, records the media, and never shows the model a draft', async () => {
		const src = makeSource({ work: 'Harbour Pact', section_ref: 'Art. 7', text: 'Obsidian harbours remain neutral during every regional emergency.' });
		makeArgument({ source_ids: [src], opponent_claim: 'Obsidian harbours neutral regional emergency attack', counter_punch: 'Obsidian harbours neutral regional emergency reply' });
		const approved = make({ title: 'Approved Anthem', artist_or_author: 'Choir', genre: 'classical' }, true);
		const hidden = make({ title: 'Hidden Draft Song', genre: 'classical' });
		let prompt = '';
		const llm = new FakeLlm('chat', 'x', (req) => {
			prompt = req.system ?? '';
			return `Harbours stay neutral [[src:${src}]]. Soundtrack: [[media:${approved}]] and the invented [[media:${hidden}]] "Fake Song by Nobody, 9:99".`;
		});
		const ev: ContentEvent[] = [];
		for await (const e of runContent({ author: 'alice', platform: 'facebook', brief: 'Obsidian harbours neutral regional emergency', outputLocale: 'en', provider: llm, embedder: null })) ev.push(e);
		expect(prompt).toContain(`<media id="${approved}"`);
		expect(prompt).not.toContain('Hidden Draft Song');
		const body = ev.filter((e): e is Extract<ContentEvent, { type: 'token' }> => e.type === 'token').map((e) => e.text).join('');
		expect(body).toContain('Approved Anthem — Choir: https://www.youtube.com/watch?v=');
		expect(body).not.toContain('Hidden Draft Song');
		const d = ev.find((e) => e.type === 'done') as Extract<ContentEvent, { type: 'done' }>;
		expect(getDraft(d.draftId!)!.media).toEqual([approved]);
	});
});

describe('seed', () => {
	it('adds the starter media as drafts, once, with no lyrics stored', () => {
		expect(seedMedia()).toBe(SEED_MEDIA.length);
		expect(seedMedia()).toBe(0);
		const seeded = listMedia({ q: 'Attemis' })[0];
		expect(seeded).toMatchObject({ status: 'draft', ai_assisted: true, lyrics_or_transcript: null });
		expect(seeded.production_credits).toMatch(/Suno/);
	});
});
