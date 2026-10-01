import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { EMBED_HOSTS, createMedia, getMedia, isAllowedEmbed, parseMediaUrl, MediaError } from '$lib/server/media';
import { SEED_MEDIA } from '$lib/server/seed/mediaSeed';
import { human } from '$lib/server/review';

// ROBOT-09 — The Media Link & Privacy Embed Gate (docs/17_Robots/ROBOT-09-media-link-privacy-gate.md), offline half.
// Whether a link is still alive needs the network and is not checked here. Do not weaken an assertion to make it pass.

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

	it('every seed link is a valid, canonical, tracking-free link', () => {
		for (const s of SEED_MEDIA) {
			const p = parseMediaUrl(s.url);
			expect(p, s.url).not.toBeNull();
			expect(p!.url, s.url).toBe(s.url);
		}
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
		for (const f of found) expect(f).toMatch(/src=\{[a-z]+\.embed_url\}/);
	});
});
