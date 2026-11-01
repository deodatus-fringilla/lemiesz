import { db } from '$lib/server/db';
import type { MediaRecord } from '$lib/server/media';

export interface DeliberationComment {
	id: string;
	author: string;
	text: string;
	created_at: string;
}

export interface KuzniaDeliberation {
	id: number;
	item_type: 'media' | 'source';
	media_id: number | null;
	source_id: number | null;
	title: string;
	key_quote: string | null;
	theological_notes: string;
	philosophical_notes: string;
	political_notes: string;
	debate_comments: DeliberationComment[];
	status: 'draft' | 'human_approved' | 'flagged';
	created_by: string;
	created_at: string;
	updated_at: string;

	// Enriched details from joined tables
	media?: {
		id: number;
		title: string;
		artist_or_author: string;
		media_type: string;
		platform: string;
		url: string;
		embed_url: string;
		lyrics_or_transcript: string | null;
	} | null;

	source?: {
		id: number;
		work: string;
		section_ref: string;
		category: string;
		text: string;
	} | null;
}

interface DeliberationRow {
	id: number;
	item_type: 'media' | 'source';
	media_id: number | null;
	source_id: number | null;
	title: string;
	key_quote: string | null;
	theological_notes: string;
	philosophical_notes: string;
	political_notes: string;
	debate_comments_json: string;
	status: 'draft' | 'human_approved' | 'flagged';
	created_by: string;
	created_at: string;
	updated_at: string;
	// Joined fields
	m_id?: number | null;
	m_title?: string | null;
	m_artist?: string | null;
	m_media_type?: string | null;
	m_platform?: string | null;
	m_url?: string | null;
	m_embed_url?: string | null;
	m_lyrics?: string | null;
	s_id?: number | null;
	s_work?: string | null;
	s_section_ref?: string | null;
	s_category?: string | null;
	s_text?: string | null;
}

function fromRow(r: DeliberationRow): KuzniaDeliberation {
	let debate_comments: DeliberationComment[] = [];
	try {
		debate_comments = JSON.parse(r.debate_comments_json || '[]');
	} catch {
		debate_comments = [];
	}

	const {
		debate_comments_json,
		m_id, m_title, m_artist, m_media_type, m_platform, m_url, m_embed_url, m_lyrics,
		s_id, s_work, s_section_ref, s_category, s_text,
		...rest
	} = r;

	const media = m_id
		? {
				id: m_id,
				title: m_title ?? '',
				artist_or_author: m_artist ?? '',
				media_type: m_media_type ?? 'music',
				platform: m_platform ?? 'youtube',
				url: m_url ?? '',
				embed_url: m_embed_url ?? '',
				lyrics_or_transcript: m_lyrics ?? null
			}
		: null;

	const source = s_id
		? {
				id: s_id,
				work: s_work ?? '',
				section_ref: s_section_ref ?? '',
				category: s_category ?? 'canonical',
				text: s_text ?? ''
			}
		: null;

	return {
		...rest,
		debate_comments,
		media,
		source
	};
}

const SELECT_QUERY = `
	SELECT 
		k.*,
		m.id AS m_id,
		m.title AS m_title,
		m.artist_or_author AS m_artist,
		m.media_type AS m_media_type,
		m.platform AS m_platform,
		m.url AS m_url,
		m.embed_url AS m_embed_url,
		m.lyrics_or_transcript AS m_lyrics,
		s.id AS s_id,
		s.work AS s_work,
		s.section_ref AS s_section_ref,
		s.category AS s_category,
		(SELECT st.text FROM source_texts st WHERE st.source_id = s.id LIMIT 1) AS s_text
	FROM kuznia_deliberations k
	LEFT JOIN media_assets m ON m.id = k.media_id
	LEFT JOIN sources s ON s.id = k.source_id
`;

export function listDeliberations(): KuzniaDeliberation[] {
	const rows = db.prepare(`${SELECT_QUERY} ORDER BY k.updated_at DESC, k.id DESC`).all() as DeliberationRow[];
	return rows.map(fromRow);
}

export function getDeliberation(id: number): KuzniaDeliberation | null {
	const row = db.prepare(`${SELECT_QUERY} WHERE k.id = ?`).get(id) as DeliberationRow | undefined;
	return row ? fromRow(row) : null;
}

export function getDeliberationByMedia(mediaId: number): KuzniaDeliberation | null {
	const row = db.prepare(`${SELECT_QUERY} WHERE k.media_id = ?`).get(mediaId) as DeliberationRow | undefined;
	return row ? fromRow(row) : null;
}

export function getDeliberationBySource(sourceId: number): KuzniaDeliberation | null {
	const row = db.prepare(`${SELECT_QUERY} WHERE k.source_id = ?`).get(sourceId) as DeliberationRow | undefined;
	return row ? fromRow(row) : null;
}

export interface CreateDeliberationInput {
	item_type: 'media' | 'source';
	media_id?: number | null;
	source_id?: number | null;
	title: string;
	key_quote?: string | null;
	theological_notes?: string;
	philosophical_notes?: string;
	political_notes?: string;
	created_by?: string;
}

export function createDeliberation(input: CreateDeliberationInput): KuzniaDeliberation {
	if (!input.title?.trim()) throw new Error('Tytuł analizy jest wymagany');
	if (input.item_type === 'media' && !input.media_id) throw new Error('media_id jest wymagany');
	if (input.item_type === 'source' && !input.source_id) throw new Error('source_id jest wymagany');

	const r = db.prepare(`
		INSERT INTO kuznia_deliberations (
			item_type, media_id, source_id, title, key_quote,
			theological_notes, philosophical_notes, political_notes,
			debate_comments_json, created_by
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)
	`).run(
		input.item_type,
		input.media_id ?? null,
		input.source_id ?? null,
		input.title.trim(),
		input.key_quote?.trim() || null,
		input.theological_notes?.trim() || '',
		input.philosophical_notes?.trim() || '',
		input.political_notes?.trim() || '',
		input.created_by?.trim() || 'admin'
	);

	return getDeliberation(Number(r.lastInsertRowid))!;
}

export function updateDeliberation(
	id: number,
	input: {
		title?: string;
		key_quote?: string | null;
		theological_notes?: string;
		philosophical_notes?: string;
		political_notes?: string;
		status?: 'draft' | 'human_approved' | 'flagged';
	}
): KuzniaDeliberation {
	const current = getDeliberation(id);
	if (!current) throw new Error(`Analiza ${id} nie istnieje`);

	const title = input.title !== undefined ? input.title.trim() : current.title;
	const keyQuote = input.key_quote !== undefined ? (input.key_quote?.trim() || null) : current.key_quote;
	const theological = input.theological_notes !== undefined ? input.theological_notes.trim() : current.theological_notes;
	const philosophical = input.philosophical_notes !== undefined ? input.philosophical_notes.trim() : current.philosophical_notes;
	const political = input.political_notes !== undefined ? input.political_notes.trim() : current.political_notes;
	const status = input.status ?? current.status;

	db.prepare(`
		UPDATE kuznia_deliberations SET
			title = ?,
			key_quote = ?,
			theological_notes = ?,
			philosophical_notes = ?,
			political_notes = ?,
			status = ?,
			updated_at = datetime('now')
		WHERE id = ?
	`).run(title, keyQuote, theological, philosophical, political, status, id);

	return getDeliberation(id)!;
}

export function addCommentToDeliberation(id: number, comment: { author: string; text: string }): KuzniaDeliberation {
	const current = getDeliberation(id);
	if (!current) throw new Error(`Analiza ${id} nie istnieje`);
	if (!comment.text?.trim()) throw new Error('Komentarz nie może być pusty');

	const newComment: DeliberationComment = {
		id: Math.random().toString(36).slice(2, 9),
		author: comment.author.trim() || 'Użytkownik',
		text: comment.text.trim(),
		created_at: new Date().toISOString().slice(0, 16).replace('T', ' ')
	};

	const updatedComments = [...current.debate_comments, newComment];

	db.prepare(`
		UPDATE kuznia_deliberations SET
			debate_comments_json = ?,
			updated_at = datetime('now')
		WHERE id = ?
	`).run(JSON.stringify(updatedComments), id);

	return getDeliberation(id)!;
}

export function deleteDeliberation(id: number): boolean {
	return db.prepare('DELETE FROM kuznia_deliberations WHERE id = ?').run(id).changes > 0;
}
