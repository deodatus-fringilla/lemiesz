import { describe, expect, it } from 'vitest';
import { db } from './db';
import {
	createDeliberation,
	getDeliberation,
	listDeliberations,
	updateDeliberation,
	addCommentToDeliberation,
	deleteDeliberation
} from './kuznia';

describe('Kuźnia Ducha i Myśli (Phase 9)', () => {
	it('creates and retrieves a cultural deliberation for media', () => {
		const mediaId = Number(
			db.prepare(`
				INSERT INTO media_assets (slug, title, artist_or_author, media_type, genre, platform, external_id, url, embed_url, created_by)
				VALUES ('test-track', 'Test Track', 'Artist', 'music', 'patriotic_folk', 'youtube', '12345678901', 'https://youtube.com/watch?v=12345678901', 'https://www.youtube-nocookie.com/embed/12345678901', 'admin')
			`).run().lastInsertRowid
		);

		const created = createDeliberation({
			item_type: 'media',
			media_id: mediaId,
			title: 'Analiza hermeneutyczna utworu Test Track',
			key_quote: 'Kto pierwszy szedł...',
			theological_notes: 'Odniesienie do Księgi Koheleta.',
			philosophical_notes: 'Koncepcja wolności woli wg św. Tomasza.',
			political_notes: 'Odrzucenie pędu do cudzych wojen.'
		});

		expect(created.id).toBeGreaterThan(0);
		expect(created.media_id).toBe(mediaId);
		expect(created.media?.title).toBe('Test Track');
		expect(created.theological_notes).toContain('Koheleta');

		const fetched = getDeliberation(created.id);
		expect(fetched?.title).toBe('Analiza hermeneutyczna utworu Test Track');
		expect(fetched?.media?.artist_or_author).toBe('Artist');
	});

	it('adds a team debate comment to a deliberation', () => {
		const mediaId = Number(
			db.prepare(`
				INSERT INTO media_assets (slug, title, artist_or_author, media_type, genre, platform, external_id, url, embed_url, created_by)
				VALUES ('test-track-2', 'Track 2', 'Artist 2', 'music', 'other', 'youtube', '22345678902', 'https://youtube.com/watch?v=22345678902', 'https://www.youtube-nocookie.com/embed/22345678902', 'admin')
			`).run().lastInsertRowid
		);

		const created = createDeliberation({
			item_type: 'media',
			media_id: mediaId,
			title: 'Debata nad utworem'
		});

		const withComment = addCommentToDeliberation(created.id, {
			author: 'Bogdan Zięba',
			text: 'Ten fragment w 2:15 minucie idealnie nawiązuje do Izajasza 2, 4.'
		});

		expect(withComment.debate_comments).toHaveLength(1);
		expect(withComment.debate_comments[0].author).toBe('Bogdan Zięba');
		expect(withComment.debate_comments[0].text).toContain('Izajasza');
	});

	it('updates notes and deletes deliberation', () => {
		const sourceId = Number(
			db.prepare(`
				INSERT INTO sources (work, section_ref, category, license, original_locale)
				VALUES ('Pismo Święte', 'Iz 2, 4', 'scripture', 'public_domain', 'pl')
			`).run().lastInsertRowid
		);

		const created = createDeliberation({
			item_type: 'source',
			source_id: sourceId,
			title: 'Medytacja nad Izajaszem 2, 4'
		});

		const updated = updateDeliberation(created.id, {
			theological_notes: 'Przekucie mieczy na lemiesze.',
			status: 'human_approved'
		});

		expect(updated.theological_notes).toBe('Przekucie mieczy na lemiesze.');
		expect(updated.status).toBe('human_approved');

		expect(deleteDeliberation(created.id)).toBe(true);
		expect(getDeliberation(created.id)).toBeNull();
	});
});
