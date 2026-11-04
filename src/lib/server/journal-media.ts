import { getMedia, listMedia, type MediaRecord } from '$lib/server/media';
import { isBroken } from '$lib/components/journal/link-status';
import { mediaBlocks, type Block } from '$lib/journal-blocks';
import type { ContentIssue } from '$lib/server/journal-images';

/**
 * Media in journal articles: YouTube/Spotify items play behind a click-to-load card (readers' browsers contact the
 * provider only when they press play), Biblioteka web links become link cards. Only approved items reach readers.
 */
export interface EditorMedia {
	id: number;
	title: string;
	artist: string;
	media_type: string;
	platform: MediaRecord['platform'];
	status: MediaRecord['status'];
	note: string | null;
}

export function listEditorMedia(): EditorMedia[] {
	return listMedia({ kind: 'all', limit: 1000 }).map((m) => ({
		id: m.id,
		title: m.title,
		artist: m.artist_or_author,
		media_type: m.media_type,
		platform: m.platform,
		status: m.status,
		note: m.public_note
	}));
}

export type RenderedMedia =
	| { type: 'embed'; provider: 'youtube' | 'spotify'; embed_url: string; url: string; title: string; artist: string; tall: boolean; caption: string }
	| { type: 'linkcard'; url: string; title: string; artist: string; note: string | null; archive_url: string | null; broken: boolean; media_type: string; caption: string };

/** What readers see for a media block; nothing for an item that is missing or not approved. */
export function renderMedia(b: { mediaId: number; caption?: string }): RenderedMedia | null {
	const m = getMedia(b.mediaId);
	if (!m || m.status !== 'human_approved') return null;
	const caption = b.caption ?? '';
	if (m.platform === 'web' || !m.embed_url) {
		return { type: 'linkcard', url: m.url, title: m.title, artist: m.artist_or_author, note: m.public_note, archive_url: m.archive_url, broken: isBroken(m.link_status), media_type: m.media_type, caption };
	}
	// The player is the record's derived, privacy-host embed_url (ROBOT-09); YouTube starts on the same click.
	const embed_url = m.platform === 'youtube' ? `${m.embed_url}?autoplay=1` : m.embed_url;
	const tall = m.platform === 'spotify' && !/\/embed\/(track|episode)\//.test(m.embed_url);
	return { type: 'embed', provider: m.platform as 'youtube' | 'spotify', embed_url, url: m.url, title: m.title, artist: m.artist_or_author, tall, caption };
}

export function mediaIssues(blocks: Block[]): ContentIssue[] {
	return mediaBlocks(blocks).flatMap((b): ContentIssue[] => {
		const m = getMedia(b.mediaId);
		if (!m) return [{ kind: 'media', reason: 'missing', id: b.mediaId, title: null }];
		if (m.status !== 'human_approved') return [{ kind: 'media', reason: 'not_approved', id: m.id, title: m.title }];
		return [];
	});
}

/** The same as text, for errors: why the media of an article cannot go public yet (empty when they all can). */
export function findMediaProblems(blocks: Block[]): string[] {
	return mediaIssues(blocks).map((i) => (i.reason === 'missing' ? `media #${i.id} no longer exists` : `media "${i.title}" is not approved`));
}
