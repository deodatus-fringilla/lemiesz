import { describe, it, expect } from 'vitest';
import { db } from './db';

describe('SQLite Database & Pragmas', () => {
	it('enables WAL mode and foreign keys', () => {
		const journalMode = db.pragma('journal_mode', { simple: true });
		expect(journalMode).toBe('wal');

		const foreignKeys = db.pragma('foreign_keys', { simple: true });
		expect(foreignKeys).toBe(1);

		const busyTimeout = db.pragma('busy_timeout', { simple: true });
		expect(busyTimeout).toBe(5000);
	});

	it('creates all core tables via migrations', () => {
		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table'")
			.all()
			.map((r: any) => r.name);

		expect(tables).toContain('sources');
		expect(tables).toContain('source_texts');
		expect(tables).toContain('arguments');
		expect(tables).toContain('argument_texts');
		expect(tables).toContain('argument_sources');
		expect(tables).toContain('embeddings');
		expect(tables).toContain('conversations');
		expect(tables).toContain('messages');
		expect(tables).toContain('users');
		expect(tables).toContain('sessions');
		expect(tables).toContain('review_events');
	});

	it('creates FTS5 virtual tables for pl and en', () => {
		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table'")
			.all()
			.map((r: any) => r.name);

		expect(tables).toContain('fts_pl');
		expect(tables).toContain('fts_en');
	});
});
