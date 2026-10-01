// `pnpm robots` — runs the whole Robot Fleet that needs no network, model or LLM key (docs/17_Robots/README.md).
//   Static gates (ROBOT-05, ROBOT-08): run their --self-test first (the gate must be able to fail), then the real check.
//   Backend/offline gates (ROBOT-01, 02, 03, 04, 06, 07, 09, 10): one Vitest file each in tests/robots.
// ROBOT-03 and ROBOT-04 also have a model-dependent half in `pnpm eval`; ROBOT-01/02/06/07 sabotage proofs run in
// `pnpm robots:sabotage`. Exit code is non-zero if any robot fails.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const results = []; // { robot, name, ok, detail }

function node(args) {
	return spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
}

function lastLine(out) {
	return (out.trim().split('\n').filter(Boolean).pop() ?? '').trim();
}

function staticGate(robot, name, script) {
	const self = node([script, '--self-test']);
	if (self.status !== 0) {
		results.push({ robot, name, ok: false, detail: 'SELF-TEST FAILED: the gate cannot prove it detects failure\n' + self.stdout + self.stderr });
		return;
	}
	const real = node([script]);
	results.push({ robot, name, ok: real.status === 0, detail: real.status === 0 ? lastLine(real.stdout) : real.stdout + real.stderr });
}

function devServerUp() {
	return new Promise((resolve) => {
		const s = net.connect({ port: 5173, host: '127.0.0.1' }, () => (s.destroy(), resolve(true)));
		s.on('error', () => resolve(false));
		s.setTimeout(500, () => (s.destroy(), resolve(false)));
	});
}

if (await devServerUp()) {
	console.warn('warning: something is listening on :5173 (vite dev?). Vitest recompiles Paraglide messages and can break a running dev page; stop it first if the page misbehaves.\n');
}

staticGate('05', 'Locale Parity', 'scripts/robots/locale-parity.mjs');
staticGate('08', 'Fleet Census', 'scripts/robots/census-gate.mjs');

// ---- Vitest-based robots -------------------------------------------------------------------------
const NAMES = {
	'01': 'Verbatim Quotation',
	'02': 'Trust-Tier Boundary',
	'03': 'Auditor Trap (offline half)',
	'04': 'Golden Set (offline half)',
	'06': 'SQLite Disk & WAL',
	'07': 'Licence & Cleared-to-Store',
	'09': 'Media Embed & Privacy (offline half)',
	'10': 'Media Attribution & Lyrics'
};
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'robots-')), 'vitest.json');
const vitest = spawnSync(
	process.execPath,
	[path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--config', 'vitest.robots.config.ts', '--reporter=json', `--outputFile=${out}`],
	{ cwd: ROOT, encoding: 'utf8' }
);
let report = null;
try {
	report = JSON.parse(fs.readFileSync(out, 'utf8'));
} catch {
	/* handled below */
}
if (!report) {
	for (const [robot, name] of Object.entries(NAMES)) results.push({ robot, name, ok: false, detail: 'vitest produced no report\n' + vitest.stdout + vitest.stderr });
} else {
	const seen = new Set();
	for (const file of report.testResults) {
		const robot = /robot-(\d+)-/.exec(path.basename(file.name))?.[1];
		if (!robot) continue;
		seen.add(robot);
		const tests = file.assertionResults;
		const failed = tests.filter((t) => t.status !== 'passed');
		results.push({
			robot,
			name: NAMES[robot] ?? 'unnamed',
			ok: file.status === 'passed' && failed.length === 0 && tests.length > 0,
			detail: failed.length
				? failed.map((t) => `${t.fullName}\n    ${(t.failureMessages?.[0] ?? '').split('\n')[0]}`).join('\n')
				: `${tests.length} checks`
		});
	}
	for (const [robot, name] of Object.entries(NAMES)) if (!seen.has(robot)) results.push({ robot, name, ok: false, detail: 'no test file ran for this robot' });
}
fs.rmSync(path.dirname(out), { recursive: true, force: true });

// ---- report ---------------------------------------------------------------------------------------
results.sort((a, b) => a.robot.localeCompare(b.robot));
console.log('\nRobot Fleet');
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ROBOT-${r.robot}  ${r.name.padEnd(30)} ${r.ok ? r.detail : ''}`);
const failed = results.filter((r) => !r.ok);
for (const r of failed) console.error(`\nROBOT-${r.robot} ${r.name}:\n${r.detail}`);
console.log(`\n${results.length - failed.length}/${results.length} robots green` + (failed.length ? ` — ${failed.length} FAILED` : ''));
console.log('Not run here (need network/LLM): ROBOT-03/04 model halves -> `pnpm eval`; ROBOT-09 live link check (network) is not implemented.');
process.exit(failed.length ? 1 : 0);
