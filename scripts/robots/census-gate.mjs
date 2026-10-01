// ROBOT-08 — The Fleet Census & Doc-Rot Gate (docs/17_Robots/ROBOT-08-doc-rot-and-census-gate.md).
// Plain Node, no dependencies. `node scripts/robots/census-gate.mjs` audits docs/ against the repository;
// `--self-test` proves the gate can fail by auditing deliberately broken mock trees.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLACEHOLDER = /^[—–-]?$/;

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

function walk(dir, filter) {
	const out = [];
	if (!exists(dir)) return out;
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) out.push(...walk(p, filter));
		else if (filter(p)) out.push(p);
	}
	return out;
}

/** Markdown without fenced code blocks and inline code, so examples are not mistaken for links. */
function prose(md) {
	return md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

/** GitHub-style heading slugs of a markdown file. */
function anchors(md) {
	const seen = new Map();
	const slugs = new Set();
	for (const m of prose(md).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
		let slug = m[1]
			.toLowerCase()
			.replace(/[*_`~]|\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/[^\p{L}\p{N}\s-]/gu, '')
			.trim()
			.replace(/\s/g, '-');
		const n = seen.get(slug) ?? 0;
		seen.set(slug, n + 1);
		slugs.add(n ? `${slug}-${n}` : slug);
	}
	return slugs;
}

/** Table rows of a markdown file as arrays of trimmed cells. */
function rows(md) {
	return md
		.split('\n')
		.filter((l) => l.trim().startsWith('|'))
		.map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
}

/**
 * Audits a repository root (the real one, or a mock in --self-test).
 * @returns {string[]} problems, empty when the fleet and the documentation agree with the code
 */
export function runCensus(root) {
	const errors = [];
	const docs = path.join(root, 'docs');
	const robotsDir = path.join(docs, '17_Robots');
	const readme = exists(path.join(robotsDir, 'README.md')) ? read(path.join(robotsDir, 'README.md')) : '';
	const ledgerPath = path.join(docs, '10_Harness', '02_Harness_Ledger.md');
	const ledger = exists(ledgerPath) ? read(ledgerPath) : '';
	if (!readme) errors.push('docs/17_Robots/README.md is missing');
	if (!ledger) errors.push('docs/10_Harness/02_Harness_Ledger.md is missing');

	// ---- 1. the three homes ---------------------------------------------------------------
	const specs = exists(robotsDir) ? fs.readdirSync(robotsDir).filter((f) => /^ROBOT-\d+-.+\.md$/.test(f)).sort() : [];
	const numbers = new Map();
	const ledgerRows = new Map(); // number -> {status, measured}
	for (const cells of rows(ledger)) {
		const m = /ROBOT-(\d+)/.exec(cells[0] ?? '');
		if (m) ledgerRows.set(m[1], { file: cells[1] ?? '', status: cells[3] ?? '', measured: cells[4] ?? '' });
	}

	for (const file of specs) {
		const n = /^ROBOT-(\d+)-/.exec(file)[1];
		if (numbers.has(n)) errors.push(`duplicate robot number ${n}: ${numbers.get(n)} and ${file}`);
		numbers.set(n, file);

		if (!readme.includes(`(${file})`)) errors.push(`${file}: not listed in docs/17_Robots/README.md`);
		const row = ledgerRows.get(n);
		if (!row) {
			errors.push(`${file}: has no row in the Harness Ledger`);
			continue;
		}
		if (!row.file.includes(file)) errors.push(`${file}: the ledger row for ROBOT-${n} links to a different file ("${row.file}")`);

		const proposed = /proposed/i.test(row.status);
		if (/PASS/.test(row.status)) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(row.measured)) errors.push(`${file}: ledger says PASS but has no measured date (Canon 03 D2)`);
		} else if (!proposed && !/FAIL/.test(row.status)) {
			errors.push(`${file}: ledger status "${row.status}" is not PASS, FAIL or Proposed`);
		}

		const spec = read(path.join(robotsDir, file));
		const exec = rows(spec).find((c) => /Executable/i.test(c[0] ?? ''));
		if (!exec) errors.push(`${file}: its attribute table has no "Executable" row`);
		else {
			const paths = [...exec[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
			if (paths.length === 0 && !PLACEHOLDER.test(exec[1].replace(/\*/g, '')) && !proposed) errors.push(`${file}: "Executable" names no file`);
			if (paths.length === 0 && !proposed) errors.push(`${file}: is marked ${row.status} but has no executable (the third home)`);
			for (const p of paths) if (!exists(path.join(root, p))) errors.push(`${file}: executable "${p}" does not exist`);
		}
	}
	for (const n of ledgerRows.keys()) if (!numbers.has(n)) errors.push(`Ledger row ROBOT-${n} has no specification in docs/17_Robots/`);
	const claimed = specs.length ? Math.max(...[...numbers.keys()].map(Number)) : 0;
	const stated = /Highest number currently claimed:\s*\*\*ROBOT-(\d+)\*\*/.exec(readme);
	if (stated && Number(stated[1]) !== claimed) errors.push(`README says the highest robot is ${stated[1]} but the folder holds ${claimed}`);

	// ---- 2. links, anchors and machine-local paths in every document ----------------------
	const mdFiles = walk(docs, (p) => p.endsWith('.md'));
	for (const f of mdFiles) {
		const rel = path.relative(root, f).replace(/\\/g, '/');
		const raw = read(f);
		// Archived documents are kept as history: their links and paths are not maintained.
		if (/Doc type:\s*\**ARCHIVE/i.test(raw.slice(0, 600))) continue;
		const md = prose(raw);
		for (const m of md.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
			const target = m[1];
			if (/^(https?:|mailto:|tel:)/i.test(target)) continue;
			const [file, frag] = target.split('#');
			const resolved = file ? path.resolve(path.dirname(f), decodeURI(file)) : f;
			if (!exists(resolved)) {
				errors.push(`${rel}: broken link "${target}"`);
				continue;
			}
			if (frag && resolved.endsWith('.md') && !anchors(read(resolved)).has(decodeURI(frag).toLowerCase())) {
				errors.push(`${rel}: link "${target}" points to a heading that does not exist`);
			}
		}
		if (/[A-Za-z]:\\(Users|www|Program Files)\\|file:\/\/\/[A-Za-z]:/i.test(md)) {
			errors.push(`${rel}: contains a machine-local absolute path`);
		}
	}
	return errors;
}

// ---- self-test: build broken mock trees and prove each defect is detected ------------------------
function mock(files) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'census-selftest-'));
	for (const [rel, content] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
		fs.writeFileSync(path.join(dir, rel), content);
	}
	return dir;
}

function selfTest() {
	const readme = (extra = '') => `# Fleet\nHighest number currently claimed: **ROBOT-01**.\n| 01 | [One](ROBOT-01-one.md) |\n${extra}`;
	const ledger = (status = '✅ PASS', date = '2026-10-01') => `| **ROBOT-01** | [One](../17_Robots/ROBOT-01-one.md) | Static | ${status} | ${date} | proof |\n`;
	const spec = (exec = '`scripts/robots/one.mjs`') => `# R1\n| Attribute | Specification |\n|---|---|\n| **Executable** | ${exec} |\n`;
	const good = () => ({
		'docs/17_Robots/README.md': readme(),
		'docs/17_Robots/ROBOT-01-one.md': spec(),
		'docs/10_Harness/02_Harness_Ledger.md': ledger(),
		'scripts/robots/one.mjs': '//'
	});
	const cases = [
		['orphaned robot (no README entry, no ledger row)', { ...good(), 'docs/17_Robots/ROBOT-02-orphan.md': spec() }, /ROBOT-02-orphan\.md: not listed/],
		['ledger row missing', { ...good(), 'docs/10_Harness/02_Harness_Ledger.md': '# empty\n' }, /has no row in the Harness Ledger/],
		['executable missing on disk', { ...good(), 'scripts/robots/one.mjs': undefined }, /executable "scripts\/robots\/one\.mjs" does not exist/],
		['PASS without a measured date', { ...good(), 'docs/10_Harness/02_Harness_Ledger.md': ledger('✅ PASS', '—') }, /no measured date/],
		['duplicate robot number', { ...good(), 'docs/17_Robots/ROBOT-01-twin.md': spec() }, /duplicate robot number 01/],
		['broken relative link', { ...good(), 'docs/notes.md': 'See [gone](missing.md).' }, /broken link "missing\.md"/],
		['broken anchor', { ...good(), 'docs/notes.md': 'See [x](17_Robots/README.md#nope).' }, /heading that does not exist/],
		['machine-local path', { ...good(), 'docs/notes.md': 'Open C:\\Users\\someone\\x.' }, /machine-local absolute path/]
	];

	let ok = true;
	const clean = mock(good());
	const cleanErrors = runCensus(clean);
	fs.rmSync(clean, { recursive: true, force: true });
	if (cleanErrors.length) {
		console.error('self-test FAILED: a consistent mock tree was rejected:', cleanErrors);
		ok = false;
	}
	for (const [name, files, expected] of cases) {
		const dir = mock(Object.fromEntries(Object.entries(files).filter(([, v]) => v !== undefined)));
		const errors = runCensus(dir);
		fs.rmSync(dir, { recursive: true, force: true });
		const hit = errors.find((e) => expected.test(e));
		if (!hit) {
			console.error(`self-test FAILED: "${name}" was not detected (got: ${JSON.stringify(errors)})`);
			ok = false;
		} else console.log(`  self-test ok: ${name} -> ${hit}`);
	}
	return ok;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	if (process.argv.includes('--self-test')) {
		const ok = selfTest();
		console.log(ok ? 'ROBOT-08 self-test: the gate detects every sabotage case' : 'ROBOT-08 self-test: FAILED');
		process.exit(ok ? 0 : 1);
	}
	const errors = runCensus(ROOT);
	if (errors.length) {
		console.error(`ROBOT-08 FAIL — ${errors.length} problem(s):`);
		for (const e of errors) console.error('  ' + e);
		process.exit(1);
	}
	const n = fs.readdirSync(path.join(ROOT, 'docs', '17_Robots')).filter((f) => /^ROBOT-\d+-/.test(f)).length;
	console.log(`ROBOT-08 PASS — ${n} robot specs, each with a README entry, a ledger row and (unless Proposed) an existing executable; all docs links resolve`);
}
