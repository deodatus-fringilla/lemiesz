import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the translations without needing the paraglide compiler (which downloads a plugin and so is not
// available offline or in CI sandboxes): every `m.key(...)` used in the code must exist in every language,
// and the languages must agree on keys and {placeholders}.
const ROOT = process.cwd();
const LOCALES = ['pl', 'en'];
const messages = Object.fromEntries(
	LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.join(ROOT, 'messages', `${l}.json`), 'utf8')) as Record<string, string>])
);
const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((x) => x[1]))].sort();

function sourceFiles(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
		const p = path.join(dir, d.name);
		if (d.isDirectory()) return d.name === 'paraglide' ? [] : sourceFiles(p);
		return /\.(svelte|ts)$/.test(d.name) && !d.name.endsWith('.test.ts') ? [p] : [];
	});
}

/** Every `m.key(args)` call in the app, with its raw argument text. */
const calls = sourceFiles(path.join(ROOT, 'src')).flatMap((file) => {
	const code = fs.readFileSync(file, 'utf8');
	// Only files that import the paraglide `m` (elsewhere `m` is often a regex match or a loop variable).
	if (!/import\s*\{[^}]*\bm\b[^}]*\}\s*from\s*['"]\$lib\/paraglide\/messages/.test(code)) return [];
	return [...code.matchAll(/\bm\.(\w+)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map((x) => ({
		file: path.relative(ROOT, file),
		key: x[1],
		args: x[2].trim()
	}));
});

describe('translations', () => {
	it('finds message calls to check', () => {
		expect(calls.length).toBeGreaterThan(50);
	});

	it('defines every message used in the code, in every language', () => {
		const missing = calls.flatMap((c) => LOCALES.filter((l) => !(c.key in messages[l])).map((l) => `${c.file}: m.${c.key} (${l})`));
		expect(missing).toEqual([]);
	});

	it('keeps the same keys and placeholders in all languages', () => {
		const [base, ...rest] = LOCALES;
		const problems: string[] = [];
		for (const other of rest) {
			for (const k of Object.keys(messages[base])) if (!(k in messages[other])) problems.push(`${k} missing in ${other}`);
			for (const k of Object.keys(messages[other])) if (!(k in messages[base])) problems.push(`${k} missing in ${base}`);
			for (const k of Object.keys(messages[base])) {
				if (k in messages[other] && placeholders(messages[base][k]).join() !== placeholders(messages[other][k]).join()) {
					problems.push(`${k}: {${placeholders(messages[base][k])}} vs {${placeholders(messages[other][k])}}`);
				}
			}
		}
		expect(problems).toEqual([]);
	});

	it('passes the placeholders a message needs', () => {
		const problems = calls.flatMap((c) => {
			const text = messages[LOCALES[0]][c.key];
			if (text === undefined) return [];
			const needed = placeholders(text);
			if (!needed.length) return [];
			if (!c.args) return [`${c.file}: m.${c.key}() needs {${needed}}`];
			if (!c.args.startsWith('{')) return []; // a variable; its shape is checked by TypeScript once compiled
			const given = new Set([...c.args.matchAll(/([A-Za-z_]\w*)\s*(?=[:,}])/g)].map((x) => x[1]));
			const lacking = needed.filter((p) => !given.has(p));
			return lacking.length ? [`${c.file}: m.${c.key} lacks {${lacking}}`] : [];
		});
		expect(problems).toEqual([]);
	});
});
