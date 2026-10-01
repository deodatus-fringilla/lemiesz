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
		needle: "AND at.review IN ('ai_verified', 'human_approved')`", replacement: "AND at.review IN ('ai_verified')`",
		why: 'editing a source no longer makes dependent human-approved cards stale'
	},
	{
		robot: '02', file: 'src/lib/server/review.ts',
		needle: "AND at.review IN ('ai_verified', 'human_approved')`", replacement: "AND at.review IN ('never')`",
		why: 'editing a source no longer makes any dependent card stale'
	},
	{
		robot: '06', file: 'src/lib/server/db.ts',
		needle: String.raw`resolved.startsWith('\\\\') || resolved.startsWith('//')) fail(`, replacement: 'false) fail(',
		why: 'UNC network paths are accepted'
	},
	{
		robot: '06', file: 'src/lib/server/db.ts',
		needle: 'if (busyTimeout !== 5000 || foreignKeys !== 1) {', replacement: 'if (false) {',
		why: 'startup continues without busy_timeout / foreign_keys'
	},
	{
		robot: '06', file: 'src/lib/server/db.ts',
		needle: "if (dbPath !== ':memory:' && journalMode !== 'wal') {", replacement: 'if (false) {',
		why: 'startup continues when SQLite refuses WAL'
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
	},
	{
		robot: '09', file: 'src/lib/server/media.ts',
		needle: "embed_url: `https://www.youtube-nocookie.com/embed/${ytId}`", replacement: "embed_url: `https://www.youtube.com/embed/${ytId}`",
		why: 'YouTube embeds use the cookie-setting domain'
	},
	{
		robot: '09', file: 'src/lib/server/media.ts',
		needle: "export const EMBED_HOSTS = ['www.youtube-nocookie.com', 'open.spotify.com'] as const;", replacement: "export const EMBED_HOSTS = ['www.youtube-nocookie.com', 'open.spotify.com', 'www.youtube.com'] as const;",
		why: 'the code allows a host the CSP does not'
	},
	{
		robot: '09', file: 'vite.config.ts',
		needle: "'frame-src': ['https://www.youtube-nocookie.com', 'https://open.spotify.com'],", replacement: "'frame-src': ['https://www.youtube-nocookie.com', 'https://open.spotify.com', 'https://tracker.example'],",
		why: 'the CSP allows a third-party frame host'
	},
	{
		robot: '09', file: 'src/lib/server/migrations/005_media.sql',
		needle: "embed_url LIKE 'https://www.youtube-nocookie.com/embed/%' OR embed_url LIKE 'https://open.spotify.com/embed/%'", replacement: '1 = 1',
		why: 'the database accepts any embed host'
	},
	{
		robot: '10', file: 'src/lib/server/media.ts',
		needle: 'if (input.ai_assisted && blank(input.production_credits)) {', replacement: 'if (false) {',
		why: 'AI-assisted works need no credit'
	},
	{
		robot: '10', file: 'src/lib/server/media.ts',
		needle: 'if (!input.lyrics_cleared_to_store) errors.push(', replacement: 'if (false) errors.push(',
		why: 'lyrics can be stored without a clearance decision'
	},
	{
		robot: '10', file: 'src/lib/server/media.ts',
		needle: "if (actor.kind !== 'human') throw new MediaError(`${actor.kind} \"${actor.name}\" may not change the review state of media`);", replacement: '',
		why: 'the pipeline can approve media'
	},
	{
		robot: '10', file: 'src/lib/server/media.ts',
		needle: "const reset = publicChanged && current.status !== 'draft';", replacement: 'const reset = false;',
		why: 'editing credits or lyrics keeps an approved asset approved'
	}
];

const ROBOT_FILES = {
	'01': 'robot-01-verbatim-quotation.robot.ts',
	'02': 'robot-02-trust-tier-boundary.robot.ts',
	'06': 'robot-06-sqlite-disk.robot.ts',
	'07': 'robot-07-license-storage.robot.ts',
	'09': 'robot-09-media-embed.robot.ts',
	'10': 'robot-10-media-attribution.robot.ts'
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
