// `pnpm robots:sabotage` — Canon 03 D4: a robot is not green until it has proved it can fail.
// For each mutation below this script (1) breaks ONE guarded line in the application code, (2) runs the robot that
// guards it and requires a FAILURE, (3) restores the file byte for byte. A mutation the robot does not notice
// means the robot is decoration, and this script exits non-zero.
// Never run it with uncommitted edits to the files below that you are not prepared to see temporarily changed;
// originals are restored in a finally block and on Ctrl-C.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VITEST = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');

/** { robot, file (to break), needle (exact, must occur once), replacement, why } */
const MUTATIONS = [
	{
		robot: '01', file: 'src/lib/server/pipeline/spancheck.ts',
		needle: 'return normalizeForSpan(text).includes(s);', replacement: 'return true;',
		why: 'any text counts as a verbatim span'
	},
	{
		robot: '01', file: 'src/lib/server/pipeline/spancheck.ts',
		needle: 'if (!linked.has(sp.source_id)) {', replacement: 'if (false) {',
		why: 'a card may quote a source it is not linked to'
	},
	{
		robot: '01', file: 'src/lib/server/shield/cite.ts',
		needle: 'if (!this.allowed.has(id)) {', replacement: 'if (false) {',
		why: 'citations to sources that were never retrieved are let through'
	},
	{
		robot: '02', file: 'src/lib/server/rag/trust.ts',
		needle: "return opts.allowAiVerifiedInContent ? ['human_approved', 'ai_verified'] : ['human_approved'];",
		replacement: "return ['human_approved', 'ai_verified', 'draft'];",
		why: 'public output may include unapproved cards'
	},
	{
		robot: '02', file: 'src/lib/server/review.ts',
		needle: "if (actor.kind === 'human') return HUMAN_TARGETS.includes(to);", replacement: "if (actor.kind === 'human') return true;",
		why: 'a human may set ai_verified / stale'
	},
	{
		robot: '02', file: 'src/lib/server/review.ts',
		needle: 'if (!SYSTEM_TARGETS.includes(to)) return false;', replacement: 'if (false) return false;',
		why: 'the pipeline may set human_approved'
	},
	{
		robot: '02', file: 'src/lib/server/review.ts',
		needle: "AND at.review = 'ai_verified'`", replacement: "AND at.review = 'never'`",
		why: 'editing a source no longer makes dependent AI-verified cards stale'
	},
	{
		robot: '06', file: 'src/lib/server/db.ts',
		needle: String.raw`resolved.startsWith('\\\\') || resolved.startsWith('//')) fail(`, replacement: 'false) fail(',
		why: 'UNC network paths are accepted'
	},
	{
		robot: '06', file: 'src/lib/server/db.ts',
		needle: "db.pragma('busy_timeout = 5000');", replacement: "db.pragma('busy_timeout = 0');",
		why: 'concurrent writers fail instantly with SQLITE_BUSY'
	},
	{
		robot: '07', file: 'src/lib/server/seed/checklist.ts',
		needle: "if (blank(item.reviewer)) errors.push('Curator / reviewer name is required');", replacement: '',
		why: 'text can be stored with no named reviewer'
	},
	{
		robot: '07', file: 'src/lib/server/seed/checklist.ts',
		needle: "} else if (!item.cleared_to_store && item.origin && !['paraphrase', 'ai_drafted'].includes(item.origin)) {", replacement: '} else if (false) {',
		why: 'full text can be stored without clearance'
	}
];

const ROBOT_FILES = {
	'01': 'robot-01-verbatim-quotation.robot.ts',
	'02': 'robot-02-trust-tier-boundary.robot.ts',
	'06': 'robot-06-sqlite-disk.robot.ts',
	'07': 'robot-07-license-storage.robot.ts'
};

function runRobot(robot) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sabotage-'));
	const outFile = path.join(dir, 'vitest.json');
	const r = spawnSync(
		process.execPath,
		[VITEST, 'run', '--config', 'vitest.robots.config.ts', `tests/robots/${ROBOT_FILES[robot]}`, '--reporter=json', `--outputFile=${outFile}`],
		{ cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
	);
	let failedTests = [];
	let ran = 0;
	try {
		const json = JSON.parse(fs.readFileSync(outFile, 'utf8'));
		for (const f of json.testResults) {
			ran += f.assertionResults.length;
			failedTests.push(...f.assertionResults.filter((t) => t.status === 'failed').map((t) => t.title));
		}
	} catch {
		/* no report: the run crashed */
	}
	fs.rmSync(dir, { recursive: true, force: true });
	// A crash (syntax error, import failure) is not proof: only an assertion failing in a test that ran counts.
	return { ok: r.status === 0, failedTests, ran };
}

const originals = new Map();
const restoreAll = () => {
	for (const [file, text] of originals) fs.writeFileSync(path.join(ROOT, file), text);
	originals.clear();
};
process.on('SIGINT', () => (restoreAll(), process.exit(130)));

const rows = [];
try {
	for (const robot of Object.keys(ROBOT_FILES)) {
		const baseline = runRobot(robot);
		if (!baseline.ok) {
			rows.push({ robot, why: 'BASELINE', caught: false, detail: 'the robot is not green before sabotage: fix it first' });
			continue;
		}
		for (const m of MUTATIONS.filter((x) => x.robot === robot)) {
			const abs = path.join(ROOT, m.file);
			const original = fs.readFileSync(abs, 'utf8');
			const count = original.split(m.needle).length - 1;
			if (count !== 1) {
				rows.push({ robot, why: m.why, caught: false, detail: `needle found ${count} times in ${m.file} (the code changed: update the mutation)` });
				continue;
			}
			originals.set(m.file, original);
			fs.writeFileSync(abs, original.replace(m.needle, () => m.replacement));
			const r = runRobot(robot);
			fs.writeFileSync(abs, original);
			originals.delete(m.file);
			rows.push({ robot, why: m.why, caught: !r.ok && r.failedTests.length > 0, detail: r.ok ? 'ROBOT STAYED GREEN — it does not guard this' : r.failedTests.length === 0 ? 'the run crashed without a failing assertion: not a valid proof' : `failed: ${r.failedTests.slice(0, 2).join('; ')}${r.failedTests.length > 2 ? ` (+${r.failedTests.length - 2})` : ''}` });
		}
	}
} finally {
	restoreAll();
}

console.log('\nSabotage proof (each mutation must turn its robot red)');
for (const r of rows) console.log(`  ${r.caught ? 'CAUGHT ' : 'MISSED '} ROBOT-${r.robot}  ${r.why}\n           ${r.detail}`);
const missed = rows.filter((r) => !r.caught);
console.log(`\n${rows.length - missed.length}/${rows.length} mutations caught` + (missed.length ? ` — ${missed.length} MISSED` : ''));
process.exit(missed.length ? 1 : 0);
