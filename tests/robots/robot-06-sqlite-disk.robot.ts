import { describe, expect, it } from 'vitest';
import { db, assertLocalFilesystem } from '$lib/server/db';

// ROBOT-06 — The SQLite Disk & WAL Assertion Gate (docs/17_Robots/ROBOT-06-sqlite-disk-assertion.md).
// Wraps db.ts. Linux network mounts (/proc/mounts) cannot be simulated on every host; the UNC path can.
// Do not weaken an assertion to make it pass.

describe('ROBOT-06 · the database must live on a local disk', () => {
	it('SABOTAGE FIXTURE: a UNC share path aborts startup', () => {
		expect(() => assertLocalFilesystem('\\\\remote-server\\share\\lemiesz.db')).toThrow(/FATAL.*UNC/s);
		expect(() => assertLocalFilesystem('//remote-server/share/lemiesz.db')).toThrow(/UNC/);
	});

	it('local and in-memory paths are accepted', () => {
		expect(() => assertLocalFilesystem('C:\\data\\lemiesz.db')).not.toThrow();
		expect(() => assertLocalFilesystem('./data/lemiesz.db')).not.toThrow();
		expect(() => assertLocalFilesystem(':memory:')).not.toThrow();
	});
});

describe('ROBOT-06 · pragmas and isolation', () => {
	it('WAL, foreign keys and the 5 s busy timeout are active on the live connection', () => {
		expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
		expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
		expect(db.pragma('busy_timeout', { simple: true })).toBe(5000);
	});

	it('tests run on a throw-away database, never the real ./data', () => {
		const file = (db.pragma('database_list') as { file: string }[])[0].file;
		expect(file).toMatch(/lemiesz-test-/);
		expect(file).not.toMatch(/[\\/]data[\\/]lemiesz\.db$/);
	});
});
