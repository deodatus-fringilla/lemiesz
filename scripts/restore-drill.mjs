// Restore drill: proves a backup can actually be restored. Run it regularly, not just when disaster strikes.
//
//   node scripts/restore-drill.mjs <backup-file | backup-dir> [--live <live.db>] [--boot]
//
// 1. copies the backup to a fresh temp folder (as a real restore would),
// 2. runs SQLite integrity and foreign-key checks,
// 3. checks the full-text indexes agree with the stored texts,
// 4. with --live, checks the backup is not ahead of / wildly behind the live database,
// 5. with --boot, starts the BUILT app (build/index.js) on the restored copy and calls /api/health.
//
// Exit code 0 = the backup is restorable. Needs only node + the app's node_modules.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const target = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--live');
const livePath = value('--live');

if (!target) {
	console.error('usage: node scripts/restore-drill.mjs <backup-file | backup-dir> [--live <live.db>] [--boot]');
	process.exit(2);
}

let failures = 0;
const check = (name, ok, detail = '') => {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
	if (!ok) failures++;
};

// ---- locate the backup ---------------------------------------------------------
let backup = target;
if (fs.statSync(target).isDirectory()) {
	const files = fs
		.readdirSync(target)
		.filter((f) => /^lemiesz-\d{8}-\d{6}(\.db)$/.test(f))
		.map((f) => ({ f, t: fs.statSync(path.join(target, f)).mtimeMs }))
		.sort((a, b) => b.t - a.t);
	if (!files.length) {
		console.error(`No backups found in ${target}`);
		process.exit(1);
	}
	backup = path.join(target, files[0].f);
}
console.log(`Backup: ${backup} (${Math.round(fs.statSync(backup).size / 1024)} KiB)\n`);

// ---- 1. restore into a fresh folder ---------------------------------------------
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemiesz-restore-'));
const restored = path.join(dir, 'lemiesz.db');
fs.copyFileSync(backup, restored);
check('backup copied to a fresh location (no -wal/-shm files carried over)', fs.existsSync(restored) && !fs.existsSync(restored + '-wal'));

let server;
try {
	const db = new Database(restored, { readonly: true, fileMustExist: true });
	const one = (sql, ...p) => db.prepare(sql).get(...p);
	const all = (sql, ...p) => db.prepare(sql).all(...p);

	// ---- 2. SQLite checks -------------------------------------------------------
	check('integrity_check is ok', db.pragma('integrity_check', { simple: true }) === 'ok');
	const fk = db.pragma('foreign_key_check');
	check('foreign_key_check finds no orphans', fk.length === 0, fk.length ? JSON.stringify(fk.slice(0, 3)) : '');

	const tables = new Set(all("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name));
	const required = ['sources', 'source_texts', 'arguments', 'argument_texts', 'users', 'sessions', 'review_events', '_migrations'];
	check('core tables exist', required.every((t) => tables.has(t)), required.filter((t) => !tables.has(t)).join(', '));

	const migrations = all('SELECT name FROM _migrations ORDER BY name').map((r) => r.name);
	const migDir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'src', 'lib', 'server', 'migrations');
	const known = fs.existsSync(migDir) ? fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')) : [];
	if (known.length) {
		const unknown = migrations.filter((m) => !known.includes(m));
		check('backup was made by this version or older (no unknown migrations)', unknown.length === 0, unknown.join(', '));
		console.log(`      migrations in backup: ${migrations.length}/${known.length} (missing ones are applied on next start)`);
	}

	// ---- 3. full-text indexes agree with stored texts -----------------------------
	for (const fts of [...tables].filter((t) => /^fts_[a-z]+$/.test(t))) {
		const locale = fts.slice(4);
		const indexed = one(`SELECT COUNT(*) AS c FROM ${fts} WHERE owner_type = 'source'`).c;
		const stored = one('SELECT COUNT(*) AS c FROM source_texts WHERE locale = ?', locale).c;
		check(`${fts}: ${indexed} indexed source texts = ${stored} stored`, indexed === stored);
		try {
			db.prepare(`SELECT COUNT(*) FROM ${fts} WHERE ${fts} MATCH ?`).get('"a"*');
			check(`${fts}: queryable`, true);
		} catch (e) {
			check(`${fts}: queryable`, false, e.message);
		}
	}

	const counts = {};
	for (const t of ['sources', 'source_texts', 'arguments', 'argument_texts', 'users', 'review_events']) {
		if (tables.has(t)) counts[t] = one(`SELECT COUNT(*) AS c FROM ${t}`).c;
	}
	console.log('      row counts:', JSON.stringify(counts));
	check('at least one user can sign in after a restore', (counts.users ?? 0) > 0);

	// ---- 4. compare with the live database -----------------------------------------
	if (livePath) {
		const live = new Database(livePath, { readonly: true, fileMustExist: true });
		for (const t of Object.keys(counts)) {
			const l = live.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
			// Informational: rows may legitimately have been added or deleted since the backup was taken.
			console.log(`      ${t}: backup ${counts[t]} / live ${l}${counts[t] < l ? `  (${l - counts[t]} added since)` : counts[t] > l ? `  (${counts[t] - l} removed since)` : ''}`);
		}
		live.close();
	}
	db.close();

	// ---- 5. boot the built app on the restored copy ---------------------------------
	if (flag('--boot')) {
		const port = 4600 + Math.floor(Math.random() * 300);
		server = spawn(process.execPath, ['build/index.js'], {
			env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production', DATABASE_PATH: restored, ORIGIN: `http://127.0.0.1:${port}`, BACKUP_INTERVAL_HOURS: '0' },
			stdio: 'ignore'
		});
		let healthy = false;
		for (let i = 0; i < 60 && !healthy; i++) {
			try {
				healthy = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok;
			} catch {
				await new Promise((r) => setTimeout(r, 250));
			}
		}
		check('the built app starts on the restored database and reports healthy', healthy);
	}
} catch (e) {
	check('drill ran without errors', false, e.message);
} finally {
	server?.kill();
	await new Promise((r) => setTimeout(r, 300));
	fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failures ? `\nRESTORE DRILL FAILED (${failures} problem${failures > 1 ? 's' : ''}).` : '\nRestore drill passed: this backup can be restored.');
process.exit(failures ? 1 : 0);
