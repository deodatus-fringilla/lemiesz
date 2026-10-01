import { describe, it, expect } from 'vitest';
import { db, assertLocalFilesystem } from './db';
import { LOCALE_CODES } from '$lib/i18n/locales';

describe('database', () => {
	it('uses an isolated test database, never ./data', () => {
		const file = (db.pragma('database_list') as { file: string }[])[0].file;
		expect(file).not.toMatch(/[\\/]data[\\/]lemiesz\.db$/);
	});

	it('enables WAL, foreign keys and busy timeout', () => {
		expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
		expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
		expect(db.pragma('busy_timeout', { simple: true })).toBe(5000);
	});

	it('creates the schema via migrations', () => {
		const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
			(r) => r.name
		);
		for (const t of [
			'sources', 'source_texts', 'arguments', 'argument_texts', 'argument_sources', 'embeddings',
			'conversations', 'messages', 'users', 'sessions', 'review_events'
		]) {
			expect(tables).toContain(t);
		}
	});

	it('creates one FTS table per registered locale', () => {
		const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
			(r) => r.name
		);
		for (const code of LOCALE_CODES) expect(tables).toContain(`fts_${code}`);
	});

	it('rejects UNC network paths', () => {
		expect(() => assertLocalFilesystem('\\\\server\\share\\lemiesz.db')).toThrow(/UNC/);
		expect(() => assertLocalFilesystem('C:\\data\\lemiesz.db')).not.toThrow();
	});

	it('defaults cleared_to_store to 0 (no implicit clearance)', () => {
		const col = (db.prepare("PRAGMA table_info('sources')").all() as { name: string; dflt_value: string }[]).find(
			(c) => c.name === 'cleared_to_store'
		);
		expect(col?.dflt_value).toBe('0');
	});
});
