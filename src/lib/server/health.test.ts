import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from './db';
import {
	UserError,
	changeOwnPassword,
	createSession,
	createUser,
	deleteUser,
	getSessionUser,
	authenticate,
	listUsers,
	setPassword
} from './auth';
import { createBackup, backupDir } from './backup';
import { collectDashboard, pipelineHealth } from './health';
import { makeSource } from './testing';

const ids = (env: Record<string, string | undefined>) => collectDashboard(env).warnings.map((w) => w.id);
const PW = 'a-long-enough-passphrase';

describe('dashboard warnings', () => {
	beforeAll(() => {
		createUser('dash-admin', PW, 'admin');
	});

	it('flags the production misconfigurations an operator must fix', () => {
		const w = ids({ NODE_ENV: 'production', ADMIN_PASSWORD: 'still-here-123456', EMBEDDER: 'none' });
		expect(w).toContain('origin_missing');
		expect(w).toContain('admin_password_in_env');
		expect(w).toContain('embedder_off');
		expect(w).toContain('no_backup');
		expect(w).toContain('nothing_approved');
		expect(w).toContain('chat_missing');
		expect(w).toContain('pipeline_missing');
	});

	it('is quiet when the system is configured sensibly', async () => {
		// the test setup disables login; a real deployment does not
		const prev = process.env.AUTH_DISABLED;
		process.env.AUTH_DISABLED = 'false';
		makeSource({ text: 'Approved text so the Shield has something to find.' });
		await createBackup(backupDir(), 3);
		const w = ids({
			NODE_ENV: 'production',
			ORIGIN: 'https://example.org',
			EMBEDDER: 'local',
			BACKUP_DIR: backupDir(),
			LLM_CHAT_BASE_URL: 'https://a/v1', LLM_CHAT_API_KEY: 'k', LLM_CHAT_MODEL: 'gpt-x',
			LLM_DRAFTER_BASE_URL: 'https://a/v1', LLM_DRAFTER_API_KEY: 'k', LLM_DRAFTER_MODEL: 'gpt-x',
			LLM_AUDITOR_BASE_URL: 'https://b/v1', LLM_AUDITOR_API_KEY: 'k', LLM_AUDITOR_MODEL: 'gemini-x'
		});
		process.env.AUTH_DISABLED = prev ?? 'true';
		expect(w).toEqual([]);
	});

	it('warns when the drafter and the auditor are the same family', () => {
		const w = ids({
			EMBEDDER: 'local', BACKUP_DIR: backupDir(),
			LLM_DRAFTER_BASE_URL: 'https://a/v1', LLM_DRAFTER_API_KEY: 'k', LLM_DRAFTER_MODEL: 'gpt-a',
			LLM_AUDITOR_BASE_URL: 'https://a/v1', LLM_AUDITOR_API_KEY: 'k', LLM_AUDITOR_MODEL: 'gpt-b'
		});
		expect(w).toContain('models_same_family');
	});

	it('flags a stale backup as an error and turns backups-off into an error too', async () => {
		const [newest] = fs.readdirSync(backupDir()).filter((f) => /^lemiesz-/.test(f));
		const old = new Date(Date.now() - 5 * 24 * 3_600_000);
		for (const f of fs.readdirSync(backupDir())) fs.utimesSync(`${backupDir()}/${f}`, old, old);
		expect(newest).toBeTruthy();
		const d = collectDashboard({ BACKUP_DIR: backupDir() });
		expect(d.warnings.find((x) => x.id === 'backup_stale')?.severity).toBe('error');
		expect(ids({ BACKUP_INTERVAL_HOURS: '0' })).toContain('no_backup');
		await createBackup(backupDir(), 3); // restore a fresh one for later tests
	});
});

describe('pipeline health', () => {
	it('computes how often the verbatim-quote check stopped the drafter', () => {
		expect(pipelineHealth().fabricationRate).toBeNull();
		db.prepare(
			`INSERT INTO pipeline_runs (kind, actor, drafter_model, auditor_model, created_count, rejected_count, verified_count, flagged_count)
			 VALUES ('draft', 'alice', 'd', 'a', 3, 1, 2, 1)`
		).run();
		const h = pipelineHealth();
		expect(h).toMatchObject({ runs30d: 1, created: 3, rejected: 1, verified: 2, flagged: 1 });
		expect(h.fabricationRate).toBeCloseTo(0.25);
		expect(h.last?.drafter).toBe('d');
	});

	it('counts review work by reason and lists recent decisions', () => {
		const d = collectDashboard({});
		expect(d.counts.sources).toBeGreaterThan(0);
		expect(d.queue.draft + d.queue.flagged + d.queue.stale + d.queue.sampled).toBeGreaterThanOrEqual(0);
		expect(Array.isArray(d.recent)).toBe(true);
	});
});

describe('user management', () => {
	it('changing your own password needs the current one and signs out your other sessions', () => {
		const id = createUser('rotator', PW);
		const mine = createSession(id).token;
		const other = createSession(id).token;
		expect(() => changeOwnPassword(id, 'wrong-current-password', 'another-long-passphrase', mine)).toThrow(UserError);
		changeOwnPassword(id, PW, 'another-long-passphrase', mine);
		expect(getSessionUser(mine)?.username).toBe('rotator');
		expect(getSessionUser(other)).toBeNull();
		expect(authenticate('rotator', PW)).toBeNull();
		expect(authenticate('rotator', 'another-long-passphrase')?.username).toBe('rotator');
	});

	it('refuses weak new passwords', () => {
		const id = createUser('weakling', PW);
		expect(() => setPassword(id, 'short')).toThrow(/12 characters/);
		expect(() => setPassword('no-such-user', 'a-long-enough-passphrase')).toThrow(UserError);
	});

	it('an admin reset signs the user out everywhere', () => {
		const id = createUser('resetme', PW);
		const t = createSession(id).token;
		setPassword(id, 'reset-by-admin-passphrase');
		expect(getSessionUser(t)).toBeNull();
	});

	it('cannot delete yourself or the last admin, but can delete others', () => {
		const admin = listUsers().find((u) => u.role === 'admin')!;
		const other = createUser('deletable', PW);
		expect(() => deleteUser(admin.id, admin.id)).toThrow(/own account/);
		// make `admin` the only admin
		db.prepare("UPDATE users SET role = 'member' WHERE role = 'admin' AND id != ?").run(admin.id);
		const second = createUser('second-admin', PW, 'admin');
		expect(() => deleteUser(admin.id, second)).not.toThrow(); // two admins: allowed
		expect(() => deleteUser(second, other)).toThrow(/last admin/); // now only one remains
		deleteUser(other, second);
		expect(listUsers().some((u) => u.username === 'deletable')).toBe(false);
	});
});
