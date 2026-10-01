// ROBOT-05 — The Locale Parity Gate (docs/17_Robots/ROBOT-05-locale-parity-gate.md).
// Plain Node, no dependencies. `node scripts/robots/locale-parity.mjs` checks messages/*.json against the
// base locale; `--self-test` proves the gate can fail by feeding it deliberately broken dictionaries.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE_LOCALE = 'pl';

/** Flattens nested objects to dotted key paths. `$`-prefixed keys (e.g. "$schema") are metadata. */
function flatten(obj, prefix = '') {
	const out = {};
	for (const [k, v] of Object.entries(obj)) {
		if (!prefix && k.startsWith('$')) continue;
		const key = prefix ? `${prefix}.${k}` : k;
		if (v !== null && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
		else out[key] = v;
	}
	return out;
}

const params = (s) => [...new Set([...String(s).matchAll(/\{\s*([\w.]+)\s*\}/g)].map((m) => m[1]))].sort().join(',');

/** @param {Record<string, object>} dicts locale code -> parsed message file. @returns {string[]} problems */
export function checkParity(dicts, base = BASE_LOCALE) {
	const errors = [];
	const flat = Object.fromEntries(Object.entries(dicts).map(([code, d]) => [code, flatten(d)]));
	if (!flat[base]) return [`base locale "${base}" is missing`];

	for (const [code, dict] of Object.entries(flat)) {
		for (const [key, value] of Object.entries(dict)) {
			if (typeof value !== 'string') errors.push(`${code}: "${key}" is not a string`);
			else if (value.trim() === '') errors.push(`${code}: "${key}" is empty`);
			else if (/\b(TODO|FIXME)\b/.test(value)) errors.push(`${code}: "${key}" contains a TODO/FIXME placeholder`);
		}
		if (code === base) continue;
		for (const key of Object.keys(flat[base])) {
			if (!(key in dict)) errors.push(`${code}: missing key "${key}" (present in ${base})`);
			else if (typeof dict[key] === 'string' && typeof flat[base][key] === 'string' && params(dict[key]) !== params(flat[base][key])) {
				errors.push(`${code}: "${key}" has parameters {${params(dict[key])}} but ${base} has {${params(flat[base][key])}}`);
			}
		}
		for (const key of Object.keys(dict)) if (!(key in flat[base])) errors.push(`${code}: extra key "${key}" (absent in ${base})`);
	}
	return errors;
}

function selfTest() {
	const good = { pl: { a: 'Cześć {name}', b: 'Dwa' }, en: { a: 'Hello {name}', b: 'Two' } };
	const cases = [
		['missing key', { pl: { a: 'x', btn_cancel: 'Anuluj' }, en: { a: 'x' } }, /missing key "btn_cancel"/],
		['extra key', { pl: { a: 'x' }, en: { a: 'x', stray: 'y' } }, /extra key "stray"/],
		['parameter mismatch', { pl: { a: 'Cześć {name}' }, en: { a: 'Hello {user}' } }, /parameters/],
		['empty string', { pl: { a: 'x' }, en: { a: '  ' } }, /empty/],
		['TODO marker', { pl: { a: 'x' }, en: { a: 'TODO translate' } }, /TODO/],
		['nested shape mismatch', { pl: { ns: { a: 'x' } }, en: { ns: 'x' } }, /missing key "ns\.a"/]
	];
	let ok = true;
	if (checkParity(good).length) {
		console.error('self-test FAILED: a correct pair was rejected:', checkParity(good));
		ok = false;
	}
	for (const [name, dicts, expected] of cases) {
		const errors = checkParity(dicts);
		if (!errors.some((e) => expected.test(e))) {
			console.error(`self-test FAILED: "${name}" was not detected (got: ${JSON.stringify(errors)})`);
			ok = false;
		} else console.log(`  self-test ok: ${name} -> ${errors.find((e) => expected.test(e))}`);
	}
	return ok;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	if (process.argv.includes('--self-test')) {
		const ok = selfTest();
		console.log(ok ? 'ROBOT-05 self-test: the gate detects every sabotage case' : 'ROBOT-05 self-test: FAILED');
		process.exit(ok ? 0 : 1);
	}
	const dir = path.join(ROOT, 'messages');
	const dicts = {};
	for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
		dicts[path.basename(f, '.json')] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
	}
	const errors = checkParity(dicts);
	const keyCount = Object.keys(flatten(dicts[BASE_LOCALE] ?? {})).length;
	if (errors.length) {
		console.error(`ROBOT-05 FAIL — ${errors.length} problem(s):`);
		for (const e of errors) console.error('  ' + e);
		process.exit(1);
	}
	console.log(`ROBOT-05 PASS — ${Object.keys(dicts).length} locales (${Object.keys(dicts).join(', ')}), ${keyCount} keys each, parameters match`);
}
