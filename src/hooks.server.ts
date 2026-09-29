import type { Handle } from '@sveltejs/kit';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '$lib/i18n/locales';

// Simple in-memory sliding-window rate limiter to protect LLM budget
interface RateLimitRecord {
	count: number;
	resetAt: number;
}
const rateLimits = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute per IP

function isRateLimited(clientIp: string): boolean {
	const now = Date.now();
	const record = rateLimits.get(clientIp);

	if (!record || now > record.resetAt) {
		rateLimits.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return false;
	}

	record.count++;
	return record.count > MAX_REQUESTS_PER_WINDOW;
}

export const handle: Handle = async ({ event, resolve }) => {
	const clientIp = event.getClientAddress();

	// 1. Rate limiting on API routes
	if (event.url.pathname.startsWith('/api/') && isRateLimited(clientIp)) {
		return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
			status: 429,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// 2. Locale resolution from cookie or header
	const cookieLocale = event.cookies.get('locale') as Locale | undefined;
	const resolvedLocale: Locale =
		cookieLocale && cookieLocale in LOCALES ? cookieLocale : DEFAULT_LOCALE;

	event.locals.locale = resolvedLocale;

	// 3. Simple auth protection for internal routes (when AUTH_SECRET is set)
	const authSecret = process.env.AUTH_SECRET;
	if (authSecret && !event.url.pathname.startsWith('/auth') && !event.url.pathname.startsWith('/api/health')) {
		const sessionCookie = event.cookies.get('session');
		if (!sessionCookie || sessionCookie !== authSecret) {
			// Redirect or require auth if enabled
			if (event.url.pathname.startsWith('/api/')) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}
	}

	return resolve(event);
};
