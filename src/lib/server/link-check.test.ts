import { describe, expect, it } from 'vitest';
import { db } from './db';
import { createMedia, getMedia, setMediaStatus } from './media';
import { human } from './review';
import { LINK_REFUSED, LINK_UNREACHABLE, checkLibraryLinks, checkUrl, isPrivateAddress } from './link-check';

const publicDns = async () => ['93.184.216.34'];
const reply = (status: number, location?: string) => new Response(null, { status, headers: location ? { location } : {} });

describe('link check', () => {
	it('recognises private and reserved addresses, v4 and v6', () => {
		for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', 'garbage'])
			expect(isPrivateAddress(ip), ip).toBe(true);
		for (const ip of ['93.184.216.34', '8.8.8.8', '2a00:1450:4001::1']) expect(isPrivateAddress(ip), ip).toBe(false);
	});

	it('reports the HTTP status, retrying with GET when HEAD is refused', async () => {
		const methods: string[] = [];
		const fetchImpl = (async (_u: string, init: RequestInit) => (methods.push(init.method!), reply(init.method === 'HEAD' ? 405 : 200))) as typeof fetch;
		expect(await checkUrl('https://neutralnosc.pl/a', { fetchImpl, resolve: publicDns })).toBe(200);
		expect(methods).toEqual(['HEAD', 'GET']);
		expect(await checkUrl('https://neutralnosc.pl/a', { fetchImpl: (async () => reply(404)) as typeof fetch, resolve: publicDns })).toBe(404);
	});

	it('refuses hosts that resolve to private addresses, also after a redirect (SSRF)', async () => {
		let calls = 0;
		const fetchImpl = (async () => (calls++, reply(302, 'https://intranet.lemiesz.pl/admin'))) as typeof fetch;
		const resolve = async (host: string) => (host === 'intranet.lemiesz.pl' ? ['10.0.0.5'] : ['93.184.216.34']);
		expect(await checkUrl('https://neutralnosc.pl/r', { fetchImpl, resolve })).toBe(LINK_REFUSED);
		expect(calls).toBe(1); // the private hop was never requested
		expect(await checkUrl('https://rebind.example.org/', { fetchImpl, resolve: async () => ['169.254.169.254'] })).toBe(LINK_REFUSED);
		expect(await checkUrl('http://127.0.0.1/', { fetchImpl, resolve: publicDns })).toBe(LINK_REFUSED);
	});

	it('treats network errors, timeouts and redirect loops as unreachable', async () => {
		expect(await checkUrl('https://neutralnosc.pl/', { fetchImpl: (async () => { throw new Error('ECONNRESET'); }) as typeof fetch, resolve: publicDns })).toBe(LINK_UNREACHABLE);
		expect(await checkUrl('https://neutralnosc.pl/', { fetchImpl: (async () => reply(301, '/again')) as typeof fetch, resolve: publicDns })).toBe(LINK_UNREACHABLE);
		expect(await checkUrl('https://nie-istnieje.pl/', { resolve: async () => { throw new Error('ENOTFOUND'); } })).toBe(LINK_UNREACHABLE);
	});

	it('stores results without touching the approval', async () => {
		const id = createMedia({ title: 'Martwy link', artist_or_author: 'x', media_type: 'article', url: `https://neutralnosc.pl/${Date.now()}`, as_link: true, public_note: 'n' }, human('t'));
		setMediaStatus(id, 'human_approved', human('t'));
		db.prepare("UPDATE media_assets SET link_checked_at = NULL WHERE platform = 'web'").run();
		const r = await checkLibraryLinks({ fetchImpl: (async () => reply(404)) as typeof fetch, resolve: publicDns, limit: 1000 });
		expect(r.broken).toBeGreaterThanOrEqual(1);
		expect(getMedia(id)).toMatchObject({ link_status: 404, status: 'human_approved' });
		expect(getMedia(id)!.link_checked_at).toMatch(/^\d{4}-/);
	});
});
