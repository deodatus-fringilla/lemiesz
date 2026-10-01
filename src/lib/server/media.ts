import { db } from '$lib/server/db';
import type { Actor } from '$lib/server/review';
import { prepareFtsQuery } from '$lib/server/rag/fts';

/**
 * Media library (Phase 6, docs/02_Platform_Modules/05_Media_and_Culture.md). Same trust rule as the rest of the
 * platform: a new asset is always a `draft`, only a signed-in human sets `human_approved`, and any edit of what the
 * public would see resets it. Embed URLs are derived here from platform + id, never accepted from input.
 */
export const MEDIA_TYPES = ['music', 'video', 'speech', 'podcast', 'short_clip'] as const;
export const GENRES = [
	'gregorian_sacred', 'patriotic_folk', 'classical', 'reggae_acoustic', 'modern_synth', 'rock_metal', 'ambient', 'spoken_word', 'other'
] as const;
export const MEDIA_STATUSES = ['draft', 'human_approved', 'flagged'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];
export type Genre = (typeof GENRES)[number];
export type MediaStatus = (typeof MEDIA_STATUSES)[number];
export type MediaPlatform = 'youtube' | 'spotify';

/** The only hosts a media embed may use. Must equal the production CSP `frame-src` in vite.config.ts (ROBOT-09). */
export const EMBED_HOSTS = ['www.youtube-nocookie.com', 'open.spotify.com'] as const;

export class MediaError extends Error {}

export interface MediaRecord {
	id: number;
	slug: string;
	title: string;
	artist_or_author: string;
	media_type: MediaType;
	genre: Genre;
	mood: string | null;
	target_audience: string | null;
	platform: MediaPlatform;
	external_id: string;
	url: string;
	embed_url: string;
	duration_seconds: number | null;
	language: string | null;
	ai_assisted: boolean;
	production_credits: string | null;
	lyrics_or_transcript: string | null;
	lyrics_license: string | null;
	lyrics_cleared_to_store: boolean;
	notes: string | null;
	status: MediaStatus;
	reviewed_by: string | null;
	reviewed_at: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
}

type Row = Omit<MediaRecord, 'ai_assisted' | 'lyrics_cleared_to_store'> & { ai_assisted: number; lyrics_cleared_to_store: number };
const fromRow = (r: Row): MediaRecord => ({ ...r, ai_assisted: !!r.ai_assisted, lyrics_cleared_to_store: !!r.lyrics_cleared_to_store });

// ---- URL handling ---------------------------------------------------------------------------------

export interface ParsedMediaUrl {
	platform: MediaPlatform;
	external_id: string;
	url: string;
	embed_url: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/**
 * Turns a pasted link into a canonical, tracking-free URL and a privacy-respecting embed URL.
 * Returns null for anything that is not a YouTube video or a Spotify item (playlist and list parameters are dropped).
 */
export function parseMediaUrl(raw: string): ParsedMediaUrl | null {
	let u: URL;
	try {
		u = new URL(raw.trim());
	} catch {
		return null;
	}
	if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
	const host = u.hostname.toLowerCase();

	let ytId: string | null = null;
	if (host === 'youtu.be') ytId = u.pathname.split('/')[1] ?? null;
	else if (YT_HOSTS.has(host)) {
		const parts = u.pathname.split('/').filter(Boolean);
		if (parts[0] === 'watch') ytId = u.searchParams.get('v');
		else if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') ytId = parts[1] ?? null;
	}
	if (ytId !== null) {
		if (!YT_ID.test(ytId)) return null;
		return {
			platform: 'youtube',
			external_id: ytId,
			url: `https://www.youtube.com/watch?v=${ytId}`,
			embed_url: `https://www.youtube-nocookie.com/embed/${ytId}`
		};
	}

	if (host === 'open.spotify.com') {
		const parts = u.pathname.split('/').filter(Boolean);
		if (parts[0]?.startsWith('intl-')) parts.shift();
		const [kind, id] = parts;
		if (['track', 'episode', 'album', 'playlist', 'show'].includes(kind ?? '') && SPOTIFY_ID.test(id ?? '')) {
			return {
				platform: 'spotify',
				external_id: id,
				url: `https://open.spotify.com/${kind}/${id}`,
				embed_url: `https://open.spotify.com/embed/${kind}/${id}`
			};
		}
	}
	return null;
}

/** True when an embed URL points at an allowed privacy-respecting host over https. */
export function isAllowedEmbed(embedUrl: string): boolean {
	try {
		const u = new URL(embedUrl);
		return u.protocol === 'https:' && (EMBED_HOSTS as readonly string[]).includes(u.hostname) && u.pathname.startsWith('/embed/');
	} catch {
		return false;
	}
}

// ---- validation -----------------------------------------------------------------------------------

export interface MediaInput {
	title: string;
	artist_or_author: string;
	media_type: MediaType;
	genre?: Genre;
	mood?: string;
	target_audience?: string;
	url: string;
	duration_seconds?: number | null;
	language?: string;
	ai_assisted?: boolean;
	production_credits?: string;
	lyrics_or_transcript?: string;
	lyrics_license?: string;
	lyrics_cleared_to_store?: boolean;
	notes?: string;
	slug?: string;
}

const blank = (v: unknown) => typeof v !== 'string' || v.trim().length === 0;
const clean = (v: string | undefined | null): string | null => (v && v.trim() ? v.trim() : null);

export function slugify(s: string): string {
	return (
		s
			.normalize('NFD')
			.replace(/\p{M}/gu, '')
			.replace(/ł/gi, 'l')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80) || 'media'
	);
}

/** Collects every problem with an input so a form can show them at once. Used by createMedia/updateMedia and by ROBOT-10. */
export function validateMedia(input: Partial<MediaInput>): string[] {
	const errors: string[] = [];
	if (blank(input.title)) errors.push('Title is required');
	if (blank(input.artist_or_author)) errors.push('Artist or author is required');
	if (!(MEDIA_TYPES as readonly string[]).includes(input.media_type as string)) errors.push(`Type must be one of: ${MEDIA_TYPES.join(', ')}`);
	if (input.genre !== undefined && !(GENRES as readonly string[]).includes(input.genre)) errors.push(`Genre must be one of: ${GENRES.join(', ')}`);
	if (blank(input.url) || !parseMediaUrl(input.url as string)) errors.push('URL must be a YouTube video or a Spotify track/episode/album/playlist/show link');
	if (input.ai_assisted && blank(input.production_credits)) {
		errors.push('An AI-assisted work must name the AI tools in the production credits');
	}
	if (!blank(input.lyrics_or_transcript)) {
		if (!input.lyrics_cleared_to_store) errors.push('Lyrics or a transcript may be stored only after an explicit decision that they are cleared (lyrics_cleared_to_store)');
		if (blank(input.lyrics_license) || (input.lyrics_license as string).trim().length < 5) errors.push('Stored lyrics or a transcript need documented licence terms');
	}
	if (input.duration_seconds != null && (!Number.isInteger(input.duration_seconds) || input.duration_seconds <= 0)) errors.push('Duration must be a positive number of seconds');
	return errors;
}

/** Cue format "m:ss" or "m:ss - m:ss". Written by a human; never by a model. */
export const CUE_PATTERN = /^\d{1,2}:\d{2}(\s?-\s?\d{1,2}:\d{2})?$/;

// ---- CRUD -----------------------------------------------------------------------------------------

const PUBLIC_FIELDS = [
	'title', 'artist_or_author', 'media_type', 'genre', 'mood', 'target_audience', 'url', 'embed_url', 'duration_seconds', 'language',
	'ai_assisted', 'production_credits', 'lyrics_or_transcript', 'lyrics_license', 'lyrics_cleared_to_store'
] as const;

function uniqueSlug(base: string): string {
	let slug = base;
	for (let n = 2; db.prepare('SELECT 1 FROM media_assets WHERE slug = ?').get(slug); n++) slug = `${base}-${n}`;
	return slug;
}

function columns(input: MediaInput, parsed: ParsedMediaUrl) {
	return {
		title: input.title.trim(),
		artist_or_author: input.artist_or_author.trim(),
		media_type: input.media_type,
		genre: input.genre ?? 'other',
		mood: clean(input.mood),
		target_audience: clean(input.target_audience),
		platform: parsed.platform,
		external_id: parsed.external_id,
		url: parsed.url,
		embed_url: parsed.embed_url,
		duration_seconds: input.duration_seconds ?? null,
		language: clean(input.language),
		ai_assisted: input.ai_assisted ? 1 : 0,
		production_credits: clean(input.production_credits),
		lyrics_or_transcript: clean(input.lyrics_or_transcript),
		lyrics_license: clean(input.lyrics_license),
		lyrics_cleared_to_store: input.lyrics_cleared_to_store ? 1 : 0,
		notes: clean(input.notes)
	};
}

/** Creates a media asset. Always a `draft`, whatever the caller wanted. */
export function createMedia(input: MediaInput, actor: Actor): number {
	const errors = validateMedia(input);
	if (errors.length) throw new MediaError(errors.join('; '));
	const parsed = parseMediaUrl(input.url)!;
	if (db.prepare('SELECT 1 FROM media_assets WHERE platform = ? AND external_id = ?').get(parsed.platform, parsed.external_id)) {
		throw new MediaError('This video or track is already in the library');
	}
	const c = columns(input, parsed);
	const slug = uniqueSlug(slugify(input.slug ?? `${c.artist_or_author} ${c.title}`));
	const names = Object.keys(c);
	const r = db
		.prepare(`INSERT INTO media_assets (slug, ${names.join(', ')}, created_by) VALUES (?, ${names.map(() => '?').join(', ')}, ?)`)
		.run(slug, ...Object.values(c), actor.name);
	return Number(r.lastInsertRowid);
}

export function getMedia(id: number): MediaRecord | null {
	const r = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(id) as Row | undefined;
	return r ? fromRow(r) : null;
}

/** Edits an asset. Changing anything the public would see resets an approved or flagged asset to `draft`. */
export function updateMedia(id: number, input: MediaInput, actor: Actor): { changed: boolean; reset: boolean } {
	const current = getMedia(id);
	if (!current) throw new MediaError(`Media ${id} not found`);
	const errors = validateMedia(input);
	if (errors.length) throw new MediaError(errors.join('; '));
	const parsed = parseMediaUrl(input.url)!;
	const clash = db.prepare('SELECT id FROM media_assets WHERE platform = ? AND external_id = ? AND id <> ?').get(parsed.platform, parsed.external_id, id);
	if (clash) throw new MediaError('Another asset already uses this video or track');
	const c = columns(input, parsed);
	const before = current as unknown as Record<string, unknown>;
	const norm = (v: unknown) => (typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? null));
	const publicChanged = PUBLIC_FIELDS.some((f) => norm(before[f]) !== norm((c as Record<string, unknown>)[f]));
	const notesChanged = (current.notes ?? null) !== c.notes;
	if (!publicChanged && !notesChanged) return { changed: false, reset: false };

	const reset = publicChanged && current.status !== 'draft';
	const names = Object.keys(c);
	db.prepare(
		`UPDATE media_assets SET ${names.map((n) => `${n} = ?`).join(', ')},
			status = CASE WHEN ? THEN 'draft' ELSE status END,
			reviewed_by = CASE WHEN ? THEN NULL ELSE reviewed_by END,
			reviewed_at = CASE WHEN ? THEN NULL ELSE reviewed_at END,
			updated_at = datetime('now')
		 WHERE id = ?`
	).run(...Object.values(c), reset ? 1 : 0, reset ? 1 : 0, reset ? 1 : 0, id);
	void actor;
	return { changed: true, reset };
}

/**
 * Moves an asset between review states. Only a human may do it (the actor comes from the validated session, never from
 * a request body); the pipeline has no business approving media.
 */
export function setMediaStatus(id: number, to: MediaStatus, actor: Actor): void {
	if (actor.kind !== 'human') throw new MediaError(`${actor.kind} "${actor.name}" may not change the review state of media`);
	if (!(MEDIA_STATUSES as readonly string[]).includes(to)) throw new MediaError(`Unknown state "${to}"`);
	const current = getMedia(id);
	if (!current) throw new MediaError(`Media ${id} not found`);
	db.prepare(
		`UPDATE media_assets SET status = ?, reviewed_by = ?, reviewed_at = CASE WHEN ? = 'human_approved' THEN datetime('now') ELSE NULL END,
			updated_at = datetime('now') WHERE id = ?`
	).run(to, to === 'human_approved' ? actor.name : null, to, id);
}

export function deleteMedia(id: number): boolean {
	return db.prepare('DELETE FROM media_assets WHERE id = ?').run(id).changes > 0;
}

export interface MediaFilter {
	genre?: Genre;
	status?: MediaStatus;
	/** Free text over title, artist and lyrics/transcript. */
	q?: string;
	limit?: number;
}

export function listMedia(filter: MediaFilter = {}): MediaRecord[] {
	const where: string[] = [];
	const params: unknown[] = [];
	if (filter.genre) (where.push('m.genre = ?'), params.push(filter.genre));
	if (filter.status) (where.push('m.status = ?'), params.push(filter.status));
	let from = 'media_assets m';
	if (filter.q?.trim()) {
		// One sanitised group per word, joined with an explicit AND (FTS5 does not accept a bare group after a term).
		const q = filter.q
			.split(/\s+/)
			.map((w) => prepareFtsQuery(w, 'pl', 'and'))
			.filter(Boolean)
			.join(' AND ');
		if (!q) return [];
		from = 'fts_media f JOIN media_assets m ON m.id = f.rowid';
		where.push('fts_media MATCH ?');
		params.push(q);
	}
	const sql = `SELECT m.* FROM ${from} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY m.status = 'human_approved' DESC, m.title LIMIT ?`;
	return (db.prepare(sql).all(...params, filter.limit ?? 100) as Row[]).map(fromRow);
}

// ---- links to argument cards ----------------------------------------------------------------------

export interface MediaLink {
	argument_id: number;
	media_id: number;
	cue: string | null;
	notes: string | null;
}

export function linkMedia(argumentId: number, mediaId: number, cue: string | null, notes: string | null, actor: Actor): void {
	if (actor.kind !== 'human') throw new MediaError('Only a human may attach media to an argument (cues are written by people)');
	const trimmed = cue?.trim() || null;
	if (trimmed && !CUE_PATTERN.test(trimmed)) throw new MediaError('Cue must look like "0:45" or "0:45 - 1:15"');
	if (!db.prepare('SELECT 1 FROM arguments WHERE id = ?').get(argumentId)) throw new MediaError(`Argument ${argumentId} not found`);
	if (!getMedia(mediaId)) throw new MediaError(`Media ${mediaId} not found`);
	db.prepare(
		`INSERT INTO argument_media_links (argument_id, media_id, cue, notes, created_by) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(argument_id, media_id) DO UPDATE SET cue = excluded.cue, notes = excluded.notes`
	).run(argumentId, mediaId, trimmed, notes?.trim() || null, actor.name);
}

export function unlinkMedia(argumentId: number, mediaId: number): boolean {
	return db.prepare('DELETE FROM argument_media_links WHERE argument_id = ? AND media_id = ?').run(argumentId, mediaId).changes > 0;
}

export function linksForMedia(mediaId: number): (MediaLink & { opponent_claim: string | null })[] {
	return db
		.prepare(
			`SELECT l.argument_id, l.media_id, l.cue, l.notes,
				(SELECT opponent_claim FROM argument_texts t WHERE t.argument_id = l.argument_id ORDER BY t.locale LIMIT 1) AS opponent_claim
			 FROM argument_media_links l WHERE l.media_id = ? ORDER BY l.argument_id`
		)
		.all(mediaId) as (MediaLink & { opponent_claim: string | null })[];
}

// ---- Content Engine selection ---------------------------------------------------------------------

/** Genres that suit each platform (module 05 §3.B). Genre only: mood is a separate field and never a genre. */
export const PLATFORM_GENRES: Record<string, readonly Genre[]> = {
	press: ['gregorian_sacred', 'classical'],
	shorts: ['modern_synth', 'reggae_acoustic', 'rock_metal'],
	facebook: ['patriotic_folk', 'classical', 'gregorian_sacred'],
	x: ['modern_synth', 'patriotic_folk', 'rock_metal', 'reggae_acoustic']
};

export interface ContentMedia {
	id: number;
	title: string;
	artist: string;
	genre: Genre;
	mood: string | null;
	url: string;
	/** Human-written cue from an argument link, if one of the retrieved cards has it. */
	cue: string | null;
}

/**
 * The only media the Content Engine may offer a model: `human_approved`, linked to one of the retrieved argument cards
 * (those first, with their cue) or matching the platform's genres. Drafts, flagged assets and unlinked genre
 * mismatches never appear, so a model cannot reference what a human has not approved.
 */
export function mediaForContent(platform: string, argumentIds: number[], max = 3): ContentMedia[] {
	const out = new Map<number, ContentMedia>();
	const add = (r: Row & { cue?: string | null }) => {
		if (!out.has(r.id) && out.size < max) out.set(r.id, { id: r.id, title: r.title, artist: r.artist_or_author, genre: r.genre, mood: r.mood, url: r.url, cue: r.cue ?? null });
	};
	if (argumentIds.length) {
		const rows = db
			.prepare(
				`SELECT m.*, l.cue FROM argument_media_links l JOIN media_assets m ON m.id = l.media_id
				 WHERE m.status = 'human_approved' AND l.argument_id IN (${argumentIds.map(() => '?').join(',')})
				 ORDER BY l.cue IS NULL, m.id`
			)
			.all(...argumentIds) as (Row & { cue: string | null })[];
		rows.forEach(add);
	}
	const genres = PLATFORM_GENRES[platform] ?? [];
	if (genres.length && out.size < max) {
		const rows = db
			.prepare(`SELECT * FROM media_assets WHERE status = 'human_approved' AND genre IN (${genres.map(() => '?').join(',')}) ORDER BY id`)
			.all(...genres) as Row[];
		rows.forEach((r) => add(r));
	}
	return [...out.values()];
}

/** The text a `[[media:ID]]` token becomes: database fields only, never model output. */
export function renderMediaReference(m: ContentMedia, platform: string): string {
	const base = `${m.title} — ${m.artist}`;
	if (platform === 'shorts') return m.cue ? `${base}, ${m.cue}` : base;
	return `${base}: ${m.url}`;
}
