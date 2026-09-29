import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Local disk verification: SQLite WAL requires POSIX/Win32 local file locking
function assertLocalFilesystem(dbPath: string): void {
	const resolved = path.resolve(dbPath);
	if (resolved.startsWith('\\\\') || resolved.startsWith('//')) {
		throw new Error(
			`[FATAL] Database path "${resolved}" is on a UNC network share. SQLite WAL mode requires a local filesystem with POSIX/Win32 file locking to prevent data corruption. Please set DATABASE_PATH to a local disk.`
		);
	}
}

const DB_PATH = process.env.DATABASE_PATH || './data/lemiesz.db';
assertLocalFilesystem(DB_PATH);

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
	fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(DB_PATH);

// Configure concurrency & safety pragmas
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
		db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name)
	);

	const sortedMigrations = Object.entries(migrationModules).sort(([a], [b]) =>
		a.localeCompare(b)
	);

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

// Auto-run migrations on startup
runMigrations();
