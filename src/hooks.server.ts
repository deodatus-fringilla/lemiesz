import { redirect, type Handle } from '@sveltejs/kit';
import { PUBLIC_JOURNAL_PATH } from '$lib/journal-paths';
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { RateLimiter, spendsLlm } from '$lib/server/rateLimit';
import {
	SESSION_COOKIE,
	authDisabled,
	ensureBootstrapAdmin,
	getSessionUser,
	purgeExpiredSessions,
	type SessionUser
} from '$lib/server/auth';
import { startBackupScheduler } from '$lib/server/backup';

// ---- startup -------------------------------------------------------------
// A new database gets its starting content from data/baseline.sql when $lib/server/db opens it (no seed code).
ensureBootstrapAdmin();
purgeExpiredSessions();
startBackupScheduler();
if (process.env.NODE_ENV === 'production' && !process.env.ORIGIN && !process.env.PROTOCOL_HEADER) {
	console.warn(
		'[config] ORIGIN is not set: adapter-node assumes https, so form POSTs over plain http will be rejected. Set ORIGIN to the public URL.'
	);
}
if (authDisabled()) console.warn('[auth] AUTH_DISABLED=true: every request is treated as the dev user.');

// ---- rate limits ------------------------------------------------------------------
const apiLimiter = new RateLimiter(60, 60_000); // per client IP
const loginLimiter = new RateLimiter(10, 60_000); // per client IP
// Public journal reads per client IP: generous for people, a brake for scrapers and floods.
const readerLimiter = new RateLimiter(Number(process.env.JOURNAL_READS_PER_MINUTE ?? 300), 60_000);
// Per signed-in user, per day: caps what a leaked session or a runaway script can spend on LLM calls.
const llmBudget = new RateLimiter(Number(process.env.LLM_DAILY_REQUESTS ?? 300), 24 * 3_600_000);

const DEV_USER: SessionUser = { id: 'dev', username: 'dev', role: 'admin' };
const PUBLIC_PATHS = ['/', '/login', '/api/health', '/robots.txt'];

/** The public journal (articles, Biblioteka, RSS, sitemap) is readable without signing in, but only read. */
const isPublicRead = (path: string, method: string) => (method === 'GET' || method === 'HEAD') && PUBLIC_JOURNAL_PATH.test(path);

function jsonError(status: number, error: string) {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

const authHandle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	let ip = 'unknown';
	try {
		ip = event.getClientAddress();
	} catch {
		// no address available (e.g. prerender)
	}

	if (path === '/login' && event.request.method === 'POST' && loginLimiter.limited(ip)) {
		return jsonError(429, 'Too many login attempts. Try again in a minute.');
	}
	if (path.startsWith('/api/') && path !== '/api/health' && apiLimiter.limited(ip)) {
		return jsonError(429, 'Too many requests. Please slow down.');
	}

	event.locals.user = authDisabled() ? DEV_USER : getSessionUser(event.cookies.get(SESSION_COOKIE));

	// Readers are limited per IP; signed-in editors are not (their session is already accountable).
	if (!event.locals.user && isPublicRead(path, event.request.method) && readerLimiter.limited(ip)) {
		return new Response('Too many requests. Please slow down.', { status: 429, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' } });
	}

	if (!event.locals.user && !PUBLIC_PATHS.includes(path) && !isPublicRead(path, event.request.method)) {
		if (path.startsWith('/api/')) return jsonError(401, 'Unauthorized');
		redirect(303, '/login');
	}
	if (event.locals.user && spendsLlm(path, event.request.method, event.url.search) && llmBudget.limited(event.locals.user.id)) {
		return jsonError(429, 'Daily limit for AI requests reached. Try again tomorrow or ask an admin to raise LLM_DAILY_REQUESTS.');
	}
	return resolve(event);
};

const i18nHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;
		event.locals.locale = locale;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});

/**
 * Journal pages may be cached briefly, but only what a signed-out reader gets: a signed-in editor's page carries their
 * name in the layout data, and a response that sets a cookie belongs to one browser. Those are never stored.
 * The page chrome follows the language cookie, so caches must key on it (Vary: Cookie, set alongside).
 */
function journalCacheControl(signedIn: boolean, response: Response): string {
	if (signedIn || response.headers.has('set-cookie') || response.status !== 200) return 'private, no-store';
	response.headers.append('Vary', 'Cookie');
	return 'public, max-age=60, stale-while-revalidate=300';
}

/** Baseline headers for every response (Mode B has no Caddy in front to add them). The CSP comes from svelte config. */
const headersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (!response.headers.has('Cache-Control') && event.url.pathname.startsWith('/api/')) response.headers.set('Cache-Control', 'no-store');
	if (isPublicRead(event.url.pathname, event.request.method)) response.headers.set('Cache-Control', journalCacheControl(!!event.locals.user, response));
	return response;
};

export const handle: Handle = sequence(headersHandle, authHandle, i18nHandle);
