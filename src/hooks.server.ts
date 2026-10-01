import { redirect, type Handle } from '@sveltejs/kit';
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
import { runSeed } from '$lib/server/seed/seed';

// ---- startup -------------------------------------------------------------
ensureBootstrapAdmin();
purgeExpiredSessions();
try {
	runSeed();
} catch (e) {
	console.error('[hooks] Startup seed error:', e);
}
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
// Per signed-in user, per day: caps what a leaked session or a runaway script can spend on LLM calls.
const llmBudget = new RateLimiter(Number(process.env.LLM_DAILY_REQUESTS ?? 300), 24 * 3_600_000);

const DEV_USER: SessionUser = { id: 'dev', username: 'dev', role: 'admin' };
const PUBLIC_PATHS = ['/login', '/api/health'];

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

	if (!event.locals.user && !PUBLIC_PATHS.includes(path)) {
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

/** Baseline headers for every response (Mode B has no Caddy in front to add them). The CSP comes from svelte config. */
const headersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (!response.headers.has('Cache-Control') && event.url.pathname.startsWith('/api/')) response.headers.set('Cache-Control', 'no-store');
	return response;
};

export const handle: Handle = sequence(headersHandle, authHandle, i18nHandle);
