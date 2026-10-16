import fs from 'node:fs';
import path from 'node:path';
import { db } from '$lib/server/db';
import type { Actor } from '$lib/server/review';
import { MediaError, slugify, type MediaStatus, MEDIA_STATUSES } from '$lib/server/media';

export const POSTER_THEMES = ['sacred_life', 'sovereignty_peace', 'history_warning', 'agrarian_ethos', 'other'] as const;
export type PosterTheme = (typeof POSTER_THEMES)[number];

export const POSTER_LAYERS = ['allegory', 'realism', 'standalone'] as const;
export type PosterLayer = (typeof POSTER_LAYERS)[number];

export interface PosterRecord {
	id: number;
	slug: string;
	title: string;
	artist_or_author: string;
	image_path: string;
	theme: PosterTheme;
	caption_pl: string | null;
	caption_en: string | null;
	symbolism_notes: string | null;
	ai_assisted: boolean;
	production_credits: string | null;
	status: MediaStatus;
	series_slug: string | null;
	series_order: number;
	is_planet: boolean;
	layer: PosterLayer;
	pair_key: string | null;
	moral_quote_pl: string | null;
	moral_quote_en: string | null;
	reviewed_by: string | null;
	reviewed_at: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
}

export interface PosterInput {
	title: string;
	artist_or_author: string;
	image_path: string;
	theme?: PosterTheme;
	caption_pl?: string;
	caption_en?: string;
	symbolism_notes?: string;
	ai_assisted?: boolean;
	production_credits?: string;
	slug?: string;
	series_slug?: string | null;
	series_order?: number;
	is_planet?: boolean;
	layer?: PosterLayer;
	pair_key?: string | null;
	moral_quote_pl?: string | null;
	moral_quote_en?: string | null;
}

type PosterRow = Omit<PosterRecord, 'ai_assisted' | 'is_planet'> & {
	ai_assisted: number;
	is_planet: number;
};

const fromRow = (r: PosterRow): PosterRecord => ({
	...r,
	ai_assisted: !!r.ai_assisted,
	is_planet: !!r.is_planet,
	series_slug: r.series_slug ?? null,
	series_order: r.series_order ?? 0,
	layer: (r.layer as PosterLayer) ?? 'standalone',
	pair_key: r.pair_key ?? null,
	moral_quote_pl: r.moral_quote_pl ?? null,
	moral_quote_en: r.moral_quote_en ?? null
});

const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);

export function isValidLocalImagePath(p: string): boolean {
	const trimmed = p.trim();
	return /^\/images\/([A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(jpg|jpeg|png|webp|svg)$/i.test(trimmed) && !trimmed.includes('..');
}

/** Lists image files available inside static/images/ (recursively) so operators can pick them in one click. */
export function listStaticImages(): string[] {
	try {
		const dir = path.resolve('static', 'images');
		if (!fs.existsSync(dir)) return [];
		const results: string[] = [];
		function walk(current: string, prefix: string) {
			for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
				if (entry.isDirectory()) {
					walk(path.join(current, entry.name), `${prefix}${entry.name}/`);
				} else if (/\.(jpg|jpeg|png|webp|svg)$/i.test(entry.name)) {
					results.push(`/images/${prefix}${entry.name}`);
				}
			}
		}
		walk(dir, '');
		return results.sort();
	} catch {
		return [];
	}
}

export function validatePoster(input: Partial<PosterInput>): string[] {
	const errors: string[] = [];
	if (!input.title?.trim()) errors.push('Title is required');
	if (!input.artist_or_author?.trim()) errors.push('Artist or author is required');
	if (!input.image_path || !isValidLocalImagePath(input.image_path)) {
		errors.push('Image path must be a local file under /images/ (e.g. /images/two_crowns_hero.jpg)');
	}
	if (input.theme !== undefined && !(POSTER_THEMES as readonly string[]).includes(input.theme)) {
		errors.push(`Theme must be one of: ${POSTER_THEMES.join(', ')}`);
	}
	if (input.layer !== undefined && !(POSTER_LAYERS as readonly string[]).includes(input.layer)) {
		errors.push(`Layer must be one of: ${POSTER_LAYERS.join(', ')}`);
	}
	if (input.ai_assisted && !input.production_credits?.trim()) {
		errors.push('An AI-assisted visual asset must name the AI tools in production credits');
	}
	return errors;
}

function uniquePosterSlug(base: string): string {
	let slug = base;
	for (let n = 2; db.prepare('SELECT 1 FROM campaign_posters WHERE slug = ?').get(slug); n++) slug = `${base}-${n}`;
	return slug;
}

export function createPoster(input: PosterInput, actor: Actor): number {
	const errors = validatePoster(input);
	if (errors.length) throw new MediaError(errors.join('; '));
	const imagePath = input.image_path.trim();
	if (db.prepare('SELECT 1 FROM campaign_posters WHERE image_path = ?').get(imagePath)) {
		throw new MediaError('This image path is already registered in campaign posters');
	}
	const slug = uniquePosterSlug(slugify(input.slug ?? input.title));
	const res = db
		.prepare(
			`INSERT INTO campaign_posters (
				slug, title, artist_or_author, image_path, theme, caption_pl, caption_en,
				symbolism_notes, ai_assisted, production_credits, status, created_by,
				series_slug, series_order, is_planet, layer, pair_key, moral_quote_pl, moral_quote_en
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			slug,
			input.title.trim(),
			input.artist_or_author.trim(),
			imagePath,
			input.theme ?? 'sacred_life',
			clean(input.caption_pl),
			clean(input.caption_en),
			clean(input.symbolism_notes),
			input.ai_assisted ? 1 : 0,
			clean(input.production_credits),
			actor.name,
			clean(input.series_slug),
			input.series_order ?? 0,
			input.is_planet ? 1 : 0,
			input.layer ?? 'standalone',
			clean(input.pair_key),
			clean(input.moral_quote_pl),
			clean(input.moral_quote_en)
		);
	return Number(res.lastInsertRowid);
}

export function getPoster(id: number): PosterRecord | null {
	const r = db.prepare('SELECT * FROM campaign_posters WHERE id = ?').get(id) as PosterRow | undefined;
	return r ? fromRow(r) : null;
}

export function listPosters(q?: string): PosterRecord[] {
	if (q?.trim()) {
		const like = `%${q.trim()}%`;
		return (
			db
				.prepare(
					`SELECT * FROM campaign_posters
					 WHERE title LIKE ? OR artist_or_author LIKE ? OR COALESCE(caption_pl, '') LIKE ? OR COALESCE(caption_en, '') LIKE ? OR COALESCE(symbolism_notes, '') LIKE ? OR COALESCE(series_slug, '') LIKE ?
					 ORDER BY status = 'human_approved' DESC, is_planet DESC, series_order ASC, id DESC`
				)
				.all(like, like, like, like, like, like) as PosterRow[]
		).map(fromRow);
	}
	return (
		db
			.prepare("SELECT * FROM campaign_posters ORDER BY status = 'human_approved' DESC, is_planet DESC, series_order ASC, id DESC")
			.all() as PosterRow[]
	).map(fromRow);
}

export function setPosterStatus(id: number, to: MediaStatus, actor: Actor): void {
	if (actor.kind !== 'human') throw new MediaError('Only a signed-in human may change the review status of a poster');
	if (!(MEDIA_STATUSES as readonly string[]).includes(to)) throw new MediaError(`Unknown status "${to}"`);
	if (!getPoster(id)) throw new MediaError(`Poster ${id} not found`);
	db.prepare(
		`UPDATE campaign_posters
		 SET status = ?, reviewed_by = ?, reviewed_at = CASE WHEN ? = 'human_approved' THEN datetime('now') ELSE NULL END, updated_at = datetime('now')
		 WHERE id = ?`
	).run(to, to === 'human_approved' ? actor.name : null, to, id);
}

export function deletePoster(id: number): boolean {
	return db.prepare('DELETE FROM campaign_posters WHERE id = ?').run(id).changes > 0;
}

export function linkPosterToArgument(argumentId: number, posterId: number, actor: Actor): void {
	if (actor.kind !== 'human' && actor.kind !== 'system') throw new MediaError('Invalid actor');
	db.prepare(
		`INSERT OR IGNORE INTO argument_poster_links (argument_id, poster_id, created_by) VALUES (?, ?, ?)`
	).run(argumentId, posterId, actor.name);
}

export function unlinkPosterFromArgument(argumentId: number, posterId: number): boolean {
	return db.prepare('DELETE FROM argument_poster_links WHERE argument_id = ? AND poster_id = ?').run(argumentId, posterId).changes > 0;
}

export function linksForPoster(posterId: number): { argument_id: number; opponent_claim: string | null }[] {
	return db
		.prepare(
			`SELECT l.argument_id,
				(SELECT opponent_claim FROM argument_texts t WHERE t.argument_id = l.argument_id ORDER BY t.locale LIMIT 1) AS opponent_claim
			 FROM argument_poster_links l WHERE l.poster_id = ? ORDER BY l.argument_id`
		)
		.all(posterId) as { argument_id: number; opponent_claim: string | null }[];
}

export function postersForArguments(argumentIds: number[], includeDrafts = false): PosterRecord[] {
	if (!argumentIds.length) return [];
	const statuses = includeDrafts ? ['human_approved', 'draft', 'flagged'] : ['human_approved'];
	const rows = db
		.prepare(
			`SELECT DISTINCT p.* FROM argument_poster_links l
			 JOIN campaign_posters p ON p.id = l.poster_id
			 WHERE l.argument_id IN (${argumentIds.map(() => '?').join(',')})
			   AND p.status IN (${statuses.map(() => '?').join(',')})
			 ORDER BY p.status = 'human_approved' DESC, p.id`
		)
		.all(...argumentIds, ...statuses) as PosterRow[];
	return rows.map(fromRow);
}

export interface SatellitePair {
	pair_key: string;
	order: number;
	allegory?: PosterRecord;
	realism?: PosterRecord;
	moral_quote_pl?: string;
	moral_quote_en?: string;
}

export interface PosterSeriesData {
	series_slug: string;
	planet: PosterRecord | null;
	satellites: PosterRecord[];
	pairs: SatellitePair[];
}

export function getSeries(seriesSlug: string, includeDrafts = true): PosterSeriesData {
	const statuses = includeDrafts ? ['human_approved', 'draft', 'flagged'] : ['human_approved'];
	const placeholders = statuses.map(() => '?').join(',');
	const rows = db
		.prepare(
			`SELECT * FROM campaign_posters
			 WHERE series_slug = ? AND status IN (${placeholders})
			 ORDER BY series_order ASC, id ASC`
		)
		.all(seriesSlug, ...statuses) as PosterRow[];

	const records = rows.map(fromRow);
	const planet = records.find((r) => r.is_planet) ?? null;
	const satellites = records.filter((r) => !r.is_planet);

	const pairMap = new Map<string, SatellitePair>();
	for (const sat of satellites) {
		const key = sat.pair_key || `step_${sat.series_order}`;
		let pair = pairMap.get(key);
		if (!pair) {
			pair = {
				pair_key: key,
				order: sat.series_order,
				moral_quote_pl: sat.moral_quote_pl ?? undefined,
				moral_quote_en: sat.moral_quote_en ?? undefined
			};
			pairMap.set(key, pair);
		}
		if (sat.layer === 'allegory') {
			pair.allegory = sat;
			if (!pair.moral_quote_pl && sat.moral_quote_pl) pair.moral_quote_pl = sat.moral_quote_pl;
			if (!pair.moral_quote_en && sat.moral_quote_en) pair.moral_quote_en = sat.moral_quote_en;
		} else if (sat.layer === 'realism') {
			pair.realism = sat;
			if (!pair.moral_quote_pl && sat.moral_quote_pl) pair.moral_quote_pl = sat.moral_quote_pl;
			if (!pair.moral_quote_en && sat.moral_quote_en) pair.moral_quote_en = sat.moral_quote_en;
		}
	}

	const pairs = Array.from(pairMap.values()).sort((a, b) => a.order - b.order);
	return {
		series_slug: seriesSlug,
		planet,
		satellites,
		pairs
	};
}

export function listSeriesSummary(): { series_slug: string; planet: PosterRecord | null; count: number }[] {
	const slugs = db
		.prepare(`SELECT DISTINCT series_slug FROM campaign_posters WHERE series_slug IS NOT NULL ORDER BY series_slug`)
		.all() as { series_slug: string }[];

	return slugs.map(({ series_slug }) => {
		const s = getSeries(series_slug, true);
		return {
			series_slug,
			planet: s.planet,
			count: s.satellites.length
		};
	});
}
