import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DB_FILE, db } from '$lib/server/db';

const NAME = /^lemiesz-\d{8}-\d{6}\.db$/;

export interface BackupInfo {
	file: string;
	path: string;
	bytes: number;
	createdAt: Date;
}

/** Where backups go. Default: a `backups` folder next to the database. Point BACKUP_DIR at ANOTHER disk to survive disk loss. */
export function backupDir(env: Record<string, string | undefined> = process.env): string {
	return env.BACKUP_DIR || path.join(path.dirname(path.resolve(DB_FILE)), 'backups');
}

const stamp = (d: Date) => {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

export function listBackups(dir = backupDir()): BackupInfo[] {
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir)
		.filter((f) => NAME.test(f))
		.map((f) => {
			const p = path.join(dir, f);
			const st = fs.statSync(p);
			return { file: f, path: p, bytes: st.size, createdAt: st.mtime };
		})
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.file.localeCompare(a.file));
}

/** Opens a backup read-only and runs SQLite's integrity check plus a look at the schema. Throws if it is not sound. */
export function verifyBackup(file: string): { tables: number; sources: number } {
	const copy = new Database(file, { readonly: true, fileMustExist: true });
	try {
		const result = copy.pragma('integrity_check', { simple: true });
		if (result !== 'ok') throw new Error(`integrity_check failed: ${String(result)}`);
		const tables = (copy.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table'").get() as { c: number }).c;
		const hasSources = copy.prepare("SELECT 1 FROM sqlite_master WHERE name = 'sources'").get();
		if (!hasSources) throw new Error('backup has no "sources" table');
		const sources = (copy.prepare('SELECT COUNT(*) AS c FROM sources').get() as { c: number }).c;
		return { tables, sources };
	} finally {
		copy.close();
	}
}

/**
 * Online backup using SQLite's backup API: safe while the app is serving requests (WAL mode), and the
 * result is a single self-contained file. The new file is verified before old ones are pruned.
 */
export async function createBackup(dir = backupDir(), keep = Number(process.env.BACKUP_KEEP ?? 14)): Promise<BackupInfo> {
	fs.mkdirSync(dir, { recursive: true });
	const now = new Date();
	let file = `lemiesz-${stamp(now)}.db`;
	// two backups in the same second (manual click + scheduler) must not overwrite each other
	for (let n = 1; fs.existsSync(path.join(dir, file)); n++) file = `lemiesz-${stamp(new Date(now.getTime() + n * 1000))}.db`;
	const dest = path.join(dir, file);

	try {
		await db.backup(dest);
		// The copy inherits WAL mode; switch it to a rollback journal so it is ONE self-contained file
		// (no -wal / -shm side files to forget when copying it off the machine).
		const copy = new Database(dest);
		try {
			copy.pragma('journal_mode = DELETE');
		} finally {
			copy.close();
		}
		verifyBackup(dest);
	} catch (e) {
		fs.rmSync(dest, { force: true });
		throw new Error(`Backup failed: ${(e as Error).message}`);
	}

	for (const old of listBackups(dir).slice(Math.max(keep, 1))) fs.rmSync(old.path, { force: true });
	const st = fs.statSync(dest);
	return { file, path: dest, bytes: st.size, createdAt: st.mtime };
}

const KEY = '__lemieszBackupTimer';
type Holder = { [KEY]?: ReturnType<typeof setInterval> };

/**
 * Starts the scheduled backup (BACKUP_INTERVAL_HOURS, default 24; 0 disables). A backup is taken shortly
 * after start if the newest one is older than the interval, so a server that restarts daily still backs up.
 */
export function startBackupScheduler(env: Record<string, string | undefined> = process.env): void {
	const hours = Number(env.BACKUP_INTERVAL_HOURS ?? 24);
	const holder = globalThis as unknown as Holder;
	if (!(hours > 0) || DB_FILE === ':memory:' || holder[KEY]) return;

	const intervalMs = hours * 3_600_000;
	const run = () =>
		createBackup().then(
			(b) => console.log(`[backup] wrote ${b.file} (${Math.round(b.bytes / 1024)} KiB)`),
			(e: Error) => console.error('[backup]', e.message)
		);
	const newest = listBackups()[0];
	if (!newest || Date.now() - newest.createdAt.getTime() > intervalMs) setTimeout(run, 60_000).unref();
	holder[KEY] = setInterval(run, intervalMs);
	holder[KEY].unref();
}
