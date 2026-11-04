import fs from 'node:fs';
import path from 'node:path';
import { db } from '$lib/server/db';
import type { Actor } from '$lib/server/review';
import { createPoster, getPoster, type PosterRecord } from '$lib/server/posters';
import { dimensions, detectType, uploadsDir, type ImageType } from '$lib/server/image-files';
import { imageBlocks, type Block, type ImageSize } from '$lib/journal-blocks';

/**
 * Images in journal articles. The library is campaign_posters (existing studio images and uploads). Readers get a light
 * web copy: uploads are already small; a heavy existing file uses its pre-made copy in static/images/web/ (same path,
 * .webp) when there is one. Only approved images with alternative text in the article's language reach readers.
 */
export interface JournalImage {
	id: number;
	title: string;
	artist: string;
	src: string;
	width: number | null;
	height: number | null;
	status: PosterRecord['status'];
	alt_pl: string | null;
	alt_en: string | null;
	license: string | null;
	origin: 'static' | 'upload';
	caption_pl: string | null;
	caption_en: string | null;
}

/** A file served from static/ lives in static/ during development and in build/client/ in production. */
function staticFile(publicPath: string): string | null {
	for (const root of ['static', path.join('build', 'client')]) {
		const f = path.resolve(root, `.${publicPath}`);
		if (fs.existsSync(f)) return f;
	}
	return null;
}

function measure(file: string): { width: number; height: number } | null {
	const b = fs.readFileSync(file);
	if (file.endsWith('.svg')) {
		const head = b.toString('utf8', 0, 2000);
		const w = /\bwidth="(\d+(?:\.\d+)?)/.exec(head)?.[1];
		const h = /\bheight="(\d+(?:\.\d+)?)/.exec(head)?.[1];
		const vb = /viewBox="[\d.\s-]*?\s([\d.]+)\s+([\d.]+)"/.exec(head);
		const width = Number(w ?? vb?.[1]);
		const height = Number(h ?? vb?.[2]);
		return width > 0 && height > 0 ? { width: Math.round(width), height: Math.round(height) } : null;
	}
	const type = detectType(b);
	return type ? dimensions(b, type as ImageType) : null;
}

const webCache = new Map<string, { src: string; width: number | null; height: number | null }>();

/** The file readers get for an image path, with its pixel size. */
export function webVersion(imagePath: string): { src: string; width: number | null; height: number | null } {
	const cached = webCache.get(imagePath);
	if (cached) return cached;
	let out: { src: string; width: number | null; height: number | null } = { src: imagePath, width: null, height: null };
	if (imagePath.startsWith('/images/uploads/')) {
		const f = path.join(uploadsDir(), path.basename(imagePath));
		if (fs.existsSync(f)) out = { src: imagePath, ...(measure(f) ?? { width: null, height: null }) };
	} else {
		const copy = imagePath.replace(/^\/images\//, '/images/web/').replace(/\.(jpe?g|png)$/i, '.webp');
		const file = (copy !== imagePath && staticFile(copy)) || staticFile(imagePath);
		if (file) out = { src: file.includes(`${path.sep}web${path.sep}`) ? copy : imagePath, ...(measure(file) ?? { width: null, height: null }) };
	}
	webCache.set(imagePath, out);
	return out;
}

const toImage = (p: PosterRecord): JournalImage => {
	const web = webVersion(p.image_path);
	return {
		id: p.id,
		title: p.title,
		artist: p.artist_or_author,
		src: web.src,
		width: p.width ?? web.width,
		height: p.height ?? web.height,
		status: p.status,
		alt_pl: p.alt_pl,
		alt_en: p.alt_en,
		license: p.license,
		origin: p.origin,
		caption_pl: p.caption_pl,
		caption_en: p.caption_en
	};
};

export function listJournalImages(): JournalImage[] {
	const rows = db.prepare("SELECT id FROM campaign_posters ORDER BY status = 'human_approved' DESC, origin = 'upload' DESC, id DESC").all() as { id: number }[];
	return rows.map((r) => toImage(getPoster(r.id)!));
}

export function getJournalImage(id: number): JournalImage | null {
	const p = getPoster(id);
	return p ? toImage(p) : null;
}

const altFor = (img: JournalImage, locale: string) => ((locale === 'en' ? img.alt_en : img.alt_pl) ?? '').trim();

/** Why the images of an article cannot go public yet (empty when they all can). */
export function findImageProblems(blocks: Block[], locale: string): string[] {
	const problems: string[] = [];
	for (const b of imageBlocks(blocks)) {
		const img = getJournalImage(b.imageId);
		if (!img) problems.push(`image #${b.imageId} no longer exists`);
		else if (img.status !== 'human_approved') problems.push(`image "${img.title}" is not approved`);
		else if (!altFor(img, locale)) problems.push(`image "${img.title}" has no alternative text in ${locale.toUpperCase()}`);
	}
	return problems;
}

export interface RenderedImage {
	type: 'image';
	src: string;
	alt: string;
	width: number | null;
	height: number | null;
	size: ImageSize;
	caption: string;
	credit: string;
	license: string | null;
}

/** What readers see for an image block; nothing at all for an image that is not approved or has no text alternative. */
export function renderImage(b: { imageId: number; size: ImageSize; caption?: string }, locale: string): RenderedImage | null {
	const img = getJournalImage(b.imageId);
	if (!img || img.status !== 'human_approved' || !altFor(img, locale)) return null;
	const caption = b.caption ?? ((locale === 'en' ? img.caption_en : img.caption_pl) ?? '');
	return { type: 'image', src: img.src, alt: altFor(img, locale), width: img.width, height: img.height, size: b.size, caption, credit: img.artist, license: img.license };
}

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Alternative text and licence are public words: changing them sends an approved image back to draft. */
export function setImageMeta(id: number, input: { alt_pl?: string; alt_en?: string; license?: string }, actor: Actor): void {
	if (actor.kind !== 'human') throw new Error(`${actor.kind} "${actor.name}" may not edit images`);
	const p = getPoster(id);
	if (!p) throw new Error(`Image ${id} not found`);
	const next = {
		alt_pl: input.alt_pl === undefined ? p.alt_pl : clean(input.alt_pl),
		alt_en: input.alt_en === undefined ? p.alt_en : clean(input.alt_en),
		license: input.license === undefined ? p.license : clean(input.license)
	};
	if (next.alt_pl === p.alt_pl && next.alt_en === p.alt_en && next.license === p.license) return;
	db.prepare(
		`UPDATE campaign_posters SET alt_pl = ?, alt_en = ?, license = ?, status = 'draft', reviewed_by = NULL, reviewed_at = NULL,
			updated_at = datetime('now') WHERE id = ?`
	).run(next.alt_pl, next.alt_en, next.license, id);
}

export interface UploadFields {
	title: string;
	artist: string;
	license: string;
	alt: string;
	locale: string;
	caption?: string;
}

/** Checks an upload's description before anything is stored (so a refused upload leaves no file behind). */
export function assertUploadFields(input: UploadFields, actor: Actor): void {
	if (actor.kind !== 'human') throw new Error('Only a signed-in person may upload images');
	if (!input.title.trim() || !input.artist.trim()) throw new Error('Title and author are required');
	if (!input.license.trim()) throw new Error('The licence is required for an uploaded image');
	if (!input.alt.trim()) throw new Error('The alternative text (description for blind readers) is required');
}

/** Registers an uploaded (already stored) file in the library as a draft image, in one transaction. */
export function registerUpload(input: UploadFields & { path: string; width: number; height: number }, actor: Actor): number {
	assertUploadFields(input, actor);
	return db.transaction(() => registerUploadRow(input, actor))();
}

function registerUploadRow(input: UploadFields & { path: string; width: number; height: number }, actor: Actor): number {
	const existing = db.prepare('SELECT id FROM campaign_posters WHERE image_path = ?').get(input.path) as { id: number } | undefined;
	if (existing) return existing.id; // the same picture uploaded twice is one library entry
	const en = input.locale === 'en';
	const id = createPoster(
		{ title: input.title, artist_or_author: input.artist, image_path: input.path, theme: 'other', [en ? 'caption_en' : 'caption_pl']: input.caption },
		actor
	);
	db.prepare(`UPDATE campaign_posters SET origin = 'upload', width = ?, height = ?, license = ?, ${en ? 'alt_en' : 'alt_pl'} = ? WHERE id = ?`).run(
		input.width, input.height, input.license.trim(), input.alt.trim(), id
	);
	return id;
}
