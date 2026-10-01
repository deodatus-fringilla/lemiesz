import { describe, it, expect } from 'vitest';
import {
	authenticate,
	createSession,
	createUser,
	deleteSession,
	getSessionUser,
	hashPassword,
	validatePasswordStrength,
	verifyPassword
} from './auth';
import { db } from './db';
import { RateLimiter } from './rateLimit';

describe('passwords', () => {
	it('hashes with a random salt and verifies', () => {
		const a = hashPassword('correct horse battery');
		const b = hashPassword('correct horse battery');
		expect(a).not.toBe(b);
		expect(verifyPassword('correct horse battery', a)).toBe(true);
		expect(verifyPassword('wrong password!!', a)).toBe(false);
		expect(verifyPassword('x', 'garbage')).toBe(false);
	});

	it('rejects short and placeholder passwords', () => {
		expect(validatePasswordStrength('short')).not.toBeNull();
		expect(validatePasswordStrength('change_me_to_a_secure_passphrase')).not.toBeNull();
		expect(validatePasswordStrength('a-long-enough-passphrase')).toBeNull();
	});
});

describe('users and sessions', () => {
	const pw = 'a-long-enough-passphrase';

	it('authenticates the right credentials only', () => {
		createUser('marta', pw, 'member');
		expect(authenticate('marta', pw)?.username).toBe('marta');
		expect(authenticate('marta', 'nope-nope-nope-nope')).toBeNull();
		expect(authenticate('ghost', pw)).toBeNull();
	});

	it('stores only a hash of the session token', () => {
		const id = createUser('jan', pw);
		const { token } = createSession(id);
		expect(getSessionUser(token)?.username).toBe('jan');
		const stored = (db.prepare('SELECT id FROM sessions').all() as { id: string }[]).map((r) => r.id);
		expect(stored).not.toContain(token);
		deleteSession(token);
		expect(getSessionUser(token)).toBeNull();
	});

	it('expires sessions', () => {
		const id = createUser('ewa', pw);
		const { token } = createSession(id);
		db.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'").run();
		expect(getSessionUser(token)).toBeNull();
	});

	it('rejects unknown tokens', () => {
		expect(getSessionUser('nonsense')).toBeNull();
		expect(getSessionUser(undefined)).toBeNull();
	});
});

describe('rate limiter', () => {
	it('limits after max hits and resets after the window, pruning old keys', () => {
		const rl = new RateLimiter(2, 1000);
		expect(rl.limited('ip', 0)).toBe(false);
		expect(rl.limited('ip', 1)).toBe(false);
		expect(rl.limited('ip', 2)).toBe(true);
		expect(rl.limited('other', 2)).toBe(false);
		expect(rl.limited('ip', 1500)).toBe(false);
		rl.prune(10_000);
		expect(rl.size).toBe(0);
	});
});
