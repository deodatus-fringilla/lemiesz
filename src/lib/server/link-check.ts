import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { db } from '$lib/server/db';
import { parseWebUrl } from '$lib/server/media';
import { isBroken } from '$lib/components/journal/link-status';

/**
 * Dead-link check for the Biblioteka. A link is fetched from this server, so it must never be steered at internal
 * addresses (SSRF): every hop, including each redirect, is re-validated and its host's resolved addresses must all be
 * public. Status codes: HTTP status of the final hop; 0 = unreachable or timed out; -1 = refused (private/invalid).
 */
export const LINK_REFUSED = -1;
export const LINK_UNREACHABLE = 0;

type Resolver = (host: string) => Promise<string[]>;
const defaultResolve: Resolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

/** True for loopback, private, link-local, CGNAT, multicast/reserved, unspecified and their IPv6 equivalents. */
export function isPrivateAddress(ip: string): boolean {
	const v = isIP(ip);
	if (v === 4) {
		const [a, b] = ip.split('.').map(Number);
		return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
	}
	if (v === 6) {
		const x = ip.toLowerCase();
		if (x === '::' || x === '::1') return true;
		if (x.startsWith('::ffff:')) return isPrivateAddress(x.slice(7));
		return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x);
	}
	return true;
}

export interface LinkCheckOptions {
	fetchImpl?: typeof fetch;
	resolve?: Resolver;
	timeoutMs?: number;
	maxRedirects?: number;
}

export async function checkUrl(url: string, opts: LinkCheckOptions = {}): Promise<number> {
	const fetchImpl = opts.fetchImpl ?? fetch;
	const resolve = opts.resolve ?? defaultResolve;
	let current = url;
	for (let hop = 0; hop <= (opts.maxRedirects ?? 5); hop++) {
		const parsed = parseWebUrl(current);
		if (!parsed) return LINK_REFUSED;
		const host = new URL(parsed.url).hostname;
		let addresses: string[];
		try {
			addresses = await resolve(host);
		} catch {
			return LINK_UNREACHABLE;
		}
		if (!addresses.length || addresses.some(isPrivateAddress)) return LINK_REFUSED;
		const request = (method: 'HEAD' | 'GET') =>
			fetchImpl(parsed.url, {
				method,
				redirect: 'manual',
				signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
				headers: { 'User-Agent': 'LemieszLinkCheck/1.0 (journal library link check)', Accept: '*/*' }
			});
		let res: Response;
		try {
			res = await request('HEAD');
			// Some servers refuse HEAD; ask again with GET before calling the link broken.
			if ([403, 405, 501].includes(res.status)) res = await request('GET');
		} catch {
			return LINK_UNREACHABLE;
		}
		if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
			current = new URL(res.headers.get('location')!, parsed.url).toString();
			continue;
		}
		return res.status;
	}
	return LINK_UNREACHABLE; // too many redirects
}

export { isBroken };

/**
 * Checks the Biblioteka's plain web links, oldest check first, a few at a time. Only the link-check fields are written,
 * so an approved item stays approved.
 */
export async function checkLibraryLinks(opts: LinkCheckOptions & { limit?: number; concurrency?: number } = {}) {
	const rows = db
		.prepare("SELECT id, url FROM media_assets WHERE platform = 'web' ORDER BY link_checked_at IS NOT NULL, link_checked_at LIMIT ?")
		.all(opts.limit ?? 50) as { id: number; url: string }[];
	const save = db.prepare("UPDATE media_assets SET link_status = ?, link_checked_at = datetime('now') WHERE id = ?");
	let broken = 0;
	const queue = [...rows];
	const worker = async () => {
		for (let r = queue.shift(); r; r = queue.shift()) {
			const status = await checkUrl(r.url, opts);
			save.run(status, r.id);
			if (isBroken(status)) broken++;
		}
	};
	await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 4) }, worker));
	return { checked: rows.length, broken };
}
