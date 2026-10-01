import crypto from 'node:crypto';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';

export interface SessionUser {
	id: string;
	username: string;
	role: 'admin' | 'member';
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'session';
const PLACEHOLDER_PASSWORDS = new Set(['change_me_to_a_secure_passphrase', 'changeme', 'password']);

/** Local-development escape hatch. Ignored (and logged) in production. */
export function authDisabled(): boolean {
	const val = env.AUTH_DISABLED || process.env.AUTH_DISABLED;
	if (val !== 'true') return false;
	const nodeEnv = env.NODE_ENV || process.env.NODE_ENV;
	if (nodeEnv === 'production') {
		console.error('[auth] AUTH_DISABLED is ignored in production.');
		return false;
	}
	return true;
}

export function hashPassword(password: string): string {
	const salt = crypto.randomBytes(16);
	const N = 16384;
	const r = 8;
	const p = 1;
	const hash = crypto.scryptSync(password, salt, 64, { N, r, p });
	return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [scheme, N, r, p, salt, hash] = stored.split('$');
	if (scheme !== 'scrypt' || !salt || !hash) return false;
	const expected = Buffer.from(hash, 'base64');
	const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length, {
		N: Number(N),
		r: Number(r),
		p: Number(p)
	});
	return crypto.timingSafeEqual(actual, expected);
}

export function validatePasswordStrength(password: string): string | null {
	if (password.length < 12) return 'Password must be at least 12 characters';
	if (PLACEHOLDER_PASSWORDS.has(password.toLowerCase())) return 'Password is a placeholder value';
	return null;
}

export function createUser(
	username: string,
	password: string,
	role: 'admin' | 'member' = 'member'
): string {
	const problem = validatePasswordStrength(password);
	if (problem) throw new Error(problem);
	const name = username.trim();
	if (!/^[\p{L}\p{N}._-]{3,40}$/u.test(name)) {
		throw new Error('Username must be 3-40 letters, digits, . _ -');
	}
	const id = crypto.randomUUID();
	db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(
		id,
		name,
		hashPassword(password),
		role
	);
	return id;
}

/** Creates the first admin from ADMIN_USERNAME / ADMIN_PASSWORD when the users table is empty. */
export function ensureBootstrapAdmin(): void {
	const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
	if (count > 0) return;
	const username = process.env.ADMIN_USERNAME;
	const password = process.env.ADMIN_PASSWORD;
	if (!username || !password) {
		if (!authDisabled()) {
			console.error(
				'[auth] No users exist. Set ADMIN_USERNAME and ADMIN_PASSWORD (min 12 chars) to create the first admin.'
			);
		}
		return;
	}
	try {
		createUser(username, password, 'admin');
		console.log(`[auth] Created bootstrap admin "${username}". Remove ADMIN_PASSWORD from the environment.`);
	} catch (e) {
		console.error('[auth] Bootstrap admin rejected:', (e as Error).message);
	}
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// Verified against when the username does not exist, so timing does not reveal valid usernames.
const DUMMY_HASH = hashPassword(crypto.randomBytes(8).toString('hex'));

export function authenticate(username: string, password: string): SessionUser | null {
	const row = db
		.prepare('SELECT id, username, role, password_hash FROM users WHERE username = ?')
		.get(username.trim()) as (SessionUser & { password_hash: string }) | undefined;
	const ok = verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
	return row && ok ? { id: row.id, username: row.username, role: row.role } : null;
}

export function createSession(userId: string): { token: string; expires: Date } {
	const token = crypto.randomBytes(32).toString('base64url');
	const expires = new Date(Date.now() + SESSION_TTL_MS);
	db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
		sha256(token),
		userId,
		expires.toISOString()
	);
	return { token, expires };
}

export function getSessionUser(token: string | undefined): SessionUser | null {
	if (!token) return null;
	const row = db
		.prepare(
			`SELECT u.id, u.username, u.role, s.expires_at
			 FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
		)
		.get(sha256(token)) as (SessionUser & { expires_at: string }) | undefined;
	if (!row) return null;
	if (new Date(row.expires_at).getTime() < Date.now()) {
		deleteSession(token);
		return null;
	}
	return { id: row.id, username: row.username, role: row.role };
}

export function deleteSession(token: string): void {
	db.prepare('DELETE FROM sessions WHERE id = ?').run(sha256(token));
}

export function purgeExpiredSessions(): void {
	db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
}
