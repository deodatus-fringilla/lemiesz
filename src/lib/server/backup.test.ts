import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBackup, listBackups, verifyBackup } from './backup';
import { createUser } from './auth';
import { makeArgument, makeSource } from './testing';
import { db } from './db';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemiesz-test-backups-'));
const drill = (...args: string[]) =>
	spawnSync(process.execPath, ['scripts/restore-drill.mjs', ...args], { encoding: 'utf8' });

beforeAll(() => {
	createUser('backup-admin', 'a-long-enough-passphrase', 'admin');
	const s = makeSource({ text: 'Backup me: the territory of neutral Powers is inviolable.' });
	makeArgument({ source_ids: [s] });
});

describe('backups', () => {
	it('writes a verified, self-contained copy of the live database', async () => {
		const b = await createBackup(dir, 5);
		expect(b.file).toMatch(/^lemiesz-\d{8}-\d{6}\.db$/);
		expect(fs.existsSync(b.path + '-wal')).toBe(false);
		expect(verifyBackup(b.path).sources).toBeGreaterThan(0);
		const copy = new Database(b.path, { readonly: true });
		expect((copy.prepare('SELECT COUNT(*) AS c FROM sources').get() as { c: number }).c).toBe(
			(db.prepare('SELECT COUNT(*) AS c FROM sources').get() as { c: number }).c
		);
		copy.close();
	});

	it('never overwrites a backup taken in the same second', async () => {
		const a = await createBackup(dir, 50);
		const b = await createBackup(dir, 50);
		expect(a.file).not.toBe(b.file);
	});

	it('keeps only the newest N backups', async () => {
		for (let i = 0; i < 4; i++) await createBackup(dir, 3);
		expect(listBackups(dir).length).toBe(3);
	});

	it('refuses to call a corrupt file a backup', () => {
		const bad = path.join(dir, 'broken.db');
		fs.writeFileSync(bad, 'this is not a database');
		expect(() => verifyBackup(bad)).toThrow();
	});

	it('ignores unrelated files in the backup folder', () => {
		fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
		expect(listBackups(dir).every((b) => /^lemiesz-/.test(b.file))).toBe(true);
	});
});

describe('restore drill (scripts/restore-drill.mjs)', () => {
	it('passes on a fresh backup and reports the restored data', async () => {
		const b = await createBackup(dir, 5);
		const r = drill(b.path);
		expect(r.stdout + r.stderr).toMatch(/Restore drill passed/);
		expect(r.status).toBe(0);
		expect(r.stdout).toMatch(/integrity_check is ok/);
		expect(r.stdout).toMatch(/fts_en: \d+ indexed source texts = \d+ stored/);
	});

	it('takes the newest backup when given a folder, and can compare with the live database', async () => {
		await createBackup(dir, 5);
		const live = (db.pragma('database_list') as { file: string }[])[0].file;
		const r = drill(dir, '--live', live);
		expect(r.status).toBe(0);
		expect(r.stdout).toMatch(/sources: backup \d+ \/ live \d+/);
	});

	it('fails loudly on a damaged backup', async () => {
		const good = await createBackup(dir, 5);
		const damaged = path.join(dir, 'damaged.db');
		const bytes = fs.readFileSync(good.path);
		fs.writeFileSync(damaged, bytes.subarray(0, Math.floor(bytes.length / 2))); // truncated file
		const r = drill(damaged);
		expect(r.status).not.toBe(0);
		expect(r.stdout + r.stderr).toMatch(/FAIL|FAILED|error/i);
	});

	it('fails when the full-text index no longer matches the texts', async () => {
		const good = await createBackup(dir, 5);
		const tampered = path.join(dir, 'tampered.db');
		fs.copyFileSync(good.path, tampered);
		const t = new Database(tampered);
		t.exec("DELETE FROM fts_en WHERE rowid IN (SELECT rowid FROM fts_en LIMIT 1)");
		t.close();
		const r = drill(tampered);
		expect(r.status).toBe(1);
		expect(r.stdout).toMatch(/FAIL\s+fts_en/);
	});

	it('fails with a usage message when no backup is given', () => {
		expect(drill().status).toBe(2);
	});
});
