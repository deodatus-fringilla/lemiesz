import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Parameters (`?`) are always safe. Table names, column names and SQL fragments are spliced into query
 * text, so each spliced expression must appear here with the reason it cannot carry user input. A new
 * interpolation fails the first test until someone reviews it and adds it; an entry that no longer
 * appears fails the second, so the list cannot rot.
 */
const PLACEHOLDERS = 'builds "?, ?, ?" from an array length; only the count is spliced, never the values';

const ALLOWED: Record<string, string> = {
	table: 'source_texts or argument_texts, from the fixed TABLES map (review.ts) or a literal in testing.ts',
	idColumn: 'source_id or argument_id, from the fixed TABLES map in review.ts',
	col: 'source_id or argument_id, a literal chosen in testing.ts (test and eval helper only)',
	from: 'media_assets joined to a fixed alias list in media.ts; the WHERE part is built from constant fragments',
	whereSql: 'the WHERE clause of arguments.ts / sources.ts, built only from constant fragments and placeholders',
	'where.join(\' AND \')': 'joins constant condition fragments; values travel as parameters',
	"where.length ? `WHERE ${where.join(' AND ')}` : ''": 'the WHERE clause of media.ts, built only from constant fragments',
	'ftsTable(locale)': 'fts_pl or fts_en, derived from the LOCALES list in i18n/locales.ts',
	'names.join(\', \')': 'column names from columns() in media.ts, a fixed object literal of keys',
	'names.map(() => \'?\').join(\', \')': PLACEHOLDERS,
	'names.map((n) => `${n} = ?`).join(\', \')': 'column names from the fixed PUBLIC_FIELDS / columns() keys in media.ts',
	'sourceIds.map(() => \'?\').join(\',\')': PLACEHOLDERS,
	'ids.map(() => \'?\').join(\',\')': PLACEHOLDERS,
	'argumentIds.map(() => \'?\').join(\',\')': PLACEHOLDERS,
	'genres.map(() => \'?\').join(\',\')': PLACEHOLDERS
};

const SQL_WORDS = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|ORDER BY|VALUES)\b/;
const SERVER_DIR = path.join(process.cwd(), 'src/lib/server');

function serverSources(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) return serverSources(full);
		return e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [full] : [];
	});
}

/** Every `${...}` expression inside a template literal that contains SQL keywords, normalised to one line. */
function spliced(file: string): string[] {
	const text = fs.readFileSync(file, 'utf8');
	const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
	const out: string[] = [];
	const visit = (node: ts.Node) => {
		if (ts.isTemplateExpression(node)) {
			const literal = node.head.text + node.templateSpans.map((s) => s.literal.text).join(' ');
			if (SQL_WORDS.test(literal)) {
				for (const span of node.templateSpans) out.push(span.expression.getText(src).replace(/\s+/g, ' '));
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(src);
	return out;
}

const found = new Set(serverSources(SERVER_DIR).flatMap(spliced));

describe('SQL identifier guard', () => {
	it('every spliced SQL expression has been reviewed', () => {
		const unreviewed = [...found].filter((e) => !(e in ALLOWED));
		expect(unreviewed, 'new SQL interpolation: check it cannot carry user input, then add it to ALLOWED').toEqual([]);
	});

	it('no reviewed entry is stale', () => {
		const stale = Object.keys(ALLOWED).filter((e) => !found.has(e));
		expect(stale, 'remove these from ALLOWED: they no longer appear in server SQL').toEqual([]);
	});
});
