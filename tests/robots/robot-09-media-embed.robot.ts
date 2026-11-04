import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { EMBED_HOSTS, createMedia, getMedia, isAllowedEmbed, listMedia, mediaForShield, parseMediaUrl, parseWebUrl, MediaError } from '$lib/server/media';
import { human } from '$lib/server/review';

// ROBOT-09 — The Media Link & Privacy Embed Gate (docs/17_Robots/ROBOT-09-media-link-privacy-gate.md), offline half.
// Runs in the baseline project (the database holds data/baseline.sql). Whether a link is still alive needs the network
// and is not checked here. Do not weaken an assertion to make it pass.

describe('ROBOT-09 · only privacy-respecting hosts can ever be embedded', () => {
	it('SABOTAGE FIXTURES: foreign hosts, look-alike domains, other schemes and the cookie-setting YouTube embed are all refused', () => {
		for (const bad of [
			'https://tracker.example/watch?v=URYM2FITucQ',
			'https://www.youtube.com.evil.example/watch?v=URYM2FITucQ',
			'https://vimeo.com/76979871',
			'ftp://www.youtube.com/watch?v=URYM2FITucQ',
			'javascript:alert(1)'
		]) {
			expect(parseMediaUrl(bad), bad).toBeNull();
		}
		expect(isAllowedEmbed('https://www.youtube.com/embed/URYM2FITucQ')).toBe(false);
		expect(isAllowedEmbed('https://tracker.example/embed/x')).toBe(false);
	});

	it('every embed the code derives is on the allow-list, whatever link style was pasted', () => {
		for (const link of [
			'https://www.youtube.com/watch?v=URYM2FITucQ&list=PL123&utm_source=x',
			'https://youtu.be/URYM2FITucQ?si=abc',
			'https://m.youtube.com/shorts/URYM2FITucQ',
			'https://open.spotify.com/intl-pl/track/4uLU6hMCjMI75M1A2tKUQC?si=abc'
		]) {
			const p = parseMediaUrl(link)!;
			expect(isAllowedEmbed(p.embed_url), link).toBe(true);
			expect(p.embed_url, link).toMatch(/^https:\/\/(www\.youtube-nocookie\.com|open\.spotify\.com)\/embed\//);
			expect(p.url).not.toMatch(/[?&](list|si|utm_)/); // tracking parameters are dropped
		}
	});

	it('the database refuses a stored embed on any other host (second lock)', () => {
		const id = createMedia({ title: 'T', artist_or_author: 'A', media_type: 'music', url: 'https://www.youtube.com/watch?v=BBBBBBBBBBB' }, human('robot-09'));
		expect(getMedia(id)!.embed_url).toBe('https://www.youtube-nocookie.com/embed/BBBBBBBBBBB');
		expect(() => db.prepare("UPDATE media_assets SET embed_url = 'https://www.youtube.com/embed/BBBBBBBBBBB' WHERE id = ?").run(id)).toThrow(/CHECK/);
		expect(() => createMedia({ title: 'T', artist_or_author: 'A', media_type: 'music', url: 'https://vimeo.com/1' }, human('robot-09'))).toThrow(MediaError);
	});

	it('every stored link of data/baseline.sql is a valid, canonical, tracking-free link', () => {
		const stored = db.prepare('SELECT url, platform, embed_url FROM media_assets').all() as { url: string; platform: string; embed_url: string | null }[];
		expect(stored.length, 'the baseline project must load data/baseline.sql').toBeGreaterThan(0);
		for (const s of stored) {
			// Biblioteka web links have no player at all; embeddable media must parse to their derived embed.
			const p = s.platform === 'web' ? parseWebUrl(s.url) : parseMediaUrl(s.url);
			expect(p, s.url).not.toBeNull();
			expect(p!.url, s.url).toBe(s.url);
			if (s.platform === 'web') expect(s.embed_url, s.url).toBeNull();
		}
	});

	it('a plain web link (Biblioteka) can never become an embed or reach a player list', () => {
		const id = createMedia(
			{ title: 'Artykuł', artist_or_author: 'Autor', media_type: 'article', url: 'https://vimeo.com/76979871', as_link: true },
			human('robot-09')
		);
		expect(getMedia(id)).toMatchObject({ platform: 'web', embed_url: null });
		expect(listMedia().some((m) => m.id === id), 'player pages list embeddable media only').toBe(false);
		db.prepare("INSERT INTO argument_media_links (argument_id, media_id, created_by) SELECT id, ?, 'robot-09' FROM arguments LIMIT 1").run(id);
		const argumentIds = (db.prepare('SELECT argument_id FROM argument_media_links WHERE media_id = ?').all(id) as { argument_id: number }[]).map((r) => r.argument_id);
		expect(mediaForShield(argumentIds, true).some((m) => m.id === id), 'the Shield embeds what it gets').toBe(false);
		expect(() => db.prepare("UPDATE media_assets SET embed_url = 'https://www.youtube-nocookie.com/embed/AAAAAAAAAAA' WHERE id = ?").run(id)).toThrow(/CHECK/);
	});
});

describe('ROBOT-09 · the CSP and the code agree', () => {
	it('production CSP frame-src is exactly the embed allow-list', () => {
		const vite = fs.readFileSync('vite.config.ts', 'utf8');
		const m = /'frame-src':\s*\[([^\]]*)\]/.exec(vite);
		expect(m, "vite.config.ts has no 'frame-src' directive").not.toBeNull();
		const hosts = [...m![1].matchAll(/'https:\/\/([^']+)'/g)].map((x) => x[1]).sort();
		expect(hosts).toEqual([...EMBED_HOSTS].sort());
	});

	it('the only <iframe> in the app embeds the derived embed_url', () => {
		const found: string[] = [];
		const walk = (dir: string) => {
			for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
				const p = path.join(dir, e.name);
				if (e.isDirectory()) walk(p);
				else if (e.name.endsWith('.svelte')) for (const x of fs.readFileSync(p, 'utf8').matchAll(/<iframe[^>]*>/g)) found.push(`${p}: ${x[0]}`);
			}
		};
		walk('src');
		expect(found.length).toBeGreaterThan(0);
		// A record's derived embed_url, however deep the record sits (e.g. deliberation.media.embed_url).
		for (const f of found) expect(f).toMatch(/src=\{[a-z]+(\.[a-z]+)*\.embed_url\}/);
	});
});
