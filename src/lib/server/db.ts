import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { LOCALES, LOCALE_CODES, ftsTable } from '$lib/i18n/locales';

const NETWORK_FS_TYPES = new Set([
	'nfs',
	'nfs4',
	'cifs',
	'smb',
	'smb3',
	'smbfs',
	'9p',
	'afs',
	'ncpfs',
	'fuse.sshfs',
	'fuse.glusterfs'
]);

/**
 * SQLite WAL needs a local filesystem with real file locking and shared memory (plan §3.4, §8).
 * Refuses UNC paths everywhere, and network mounts on Linux (checked via /proc/mounts).
 */
export function assertLocalFilesystem(dbPath: string): void {
	if (dbPath === ':memory:') return;
	const resolved = path.resolve(dbPath);
	const fail = (why: string) => {
		throw new Error(
			`[FATAL] Database path "${resolved}" ${why}. SQLite WAL requires a local disk. Set DATABASE_PATH to a local path (in Docker: the /data volume).`
		);
	};

	if (resolved.startsWith('\\\\') || resolved.startsWith('//')) fail('is on a UNC network share');

	if (process.platform === 'linux') {
		try {
			const mounts = fs
				.readFileSync('/proc/mounts', 'utf8')
				.split('\n')
				.map((line) => line.split(' '))
				.filter((p) => p.length >= 3)
				.map(([, mountPoint, type]) => ({ mountPoint: mountPoint.replace(/\\040/g, ' '), type }));
			let best: { mountPoint: string; type: string } | null = null;
			for (const m of mounts) {
				const prefix = m.mountPoint.endsWith('/') ? m.mountPoint : m.mountPoint + '/';
				if (
					(resolved === m.mountPoint || resolved.startsWith(prefix)) &&
					(!best || m.mountPoint.length > best.mountPoint.length)
				) {
					best = m;
				}
			}
			if (best && NETWORK_FS_TYPES.has(best.type)) fail(`is on a network filesystem (${best.type})`);
		} catch (e) {
			if ((e as Error).message?.startsWith('[FATAL]')) throw e;
			// /proc/mounts unreadable: nothing more we can check.
		}
	}
}

const DB_PATH = process.env.DATABASE_PATH || './data/lemiesz.db';
assertLocalFilesystem(DB_PATH);

if (DB_PATH !== ':memory:') {
	const dir = path.dirname(DB_PATH);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Path of the live database file (":memory:" in special cases). */
export const DB_FILE = DB_PATH;

export const db = new Database(DB_PATH);

// Concurrency & safety pragmas (plan §3.4)
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

// Migration runner using Vite raw imports
const migrationModules = import.meta.glob<string>('./migrations/*.sql', {
	query: '?raw',
	import: 'default',
	eager: true
});

export function runMigrations(): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS _migrations (
			id INTEGER PRIMARY KEY,
			name TEXT NOT NULL,
			applied_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
	`);

	const applied = new Set(
		(db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name)
	);

	const sortedMigrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b));

	for (const [filepath, sql] of sortedMigrations) {
		const name = path.basename(filepath);
		if (!applied.has(name)) {
			console.log(`[db] Applying migration: ${name}`);
			db.transaction(() => {
				db.exec(sql);
				db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
			})();
		}
	}
}

/**
 * Creates one FTS5 table per registered locale from the registry's tokenizer string and
 * back-fills it from stored texts when it is newly created (plan §3.2: adding a language
 * needs a registry entry, not a migration).
 */
export function ensureFtsTables(): void {
	for (const locale of LOCALE_CODES) {
		const table = ftsTable(locale);
		const exists = db
			.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
			.get(table);
		if (exists) continue;

		const tokenizer = LOCALES[locale].fts.replace(/'/g, '');
		db.transaction(() => {
			db.exec(`
				CREATE VIRTUAL TABLE ${table} USING fts5(
					owner_type,
					owner_id UNINDEXED,
					title,
					content,
					keywords,
					tokenize = '${tokenizer}'
				);
			`);
			db.prepare(
				`INSERT INTO ${table} (owner_type, owner_id, title, content, keywords)
				 SELECT 'source', st.source_id, s.work || ' ' || s.section_ref, st.text, COALESCE(st.keywords, '')
				 FROM source_texts st JOIN sources s ON s.id = st.source_id
				 WHERE st.locale = ?`
			).run(locale);
			db.prepare(
				`INSERT INTO ${table} (owner_type, owner_id, title, content, keywords)
				 SELECT 'argument', at.argument_id, at.opponent_claim, at.counter_punch, COALESCE(at.keywords, '')
				 FROM argument_texts at WHERE at.locale = ?`
			).run(locale);
		})();
		console.log(`[db] Created FTS table ${table}`);
	}
}

runMigrations();
ensureFtsTables();

// Clean shutdown: adapter-node emits 'sveltekit:shutdown' after the HTTP server has drained (SIGTERM /
// SIGINT, e.g. docker stop). Closing the database checkpoints the WAL so the main file is complete.
process.once('sveltekit:shutdown' as never, () => {
	try {
		db.pragma('wal_checkpoint(TRUNCATE)');
		db.close();
	} catch (e) {
		console.error('[db] error while closing:', (e as Error).message);
	}
});
