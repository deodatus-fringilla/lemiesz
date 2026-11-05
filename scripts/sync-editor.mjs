// `pnpm editor:sync <path-to-Editor-checkout>` — copies the article editor into src/lib/editor/.
//
// The editor is developed in its own repository (deodatus-fringilla/Editor, standalone and tested there). Lemiesz keeps
// a copy of its source so the app builds with no outside dependency (Docker, offline VPS). This script is the ONLY way
// that copy is changed: never edit files in src/lib/editor/ by hand, change the Editor repository and sync again.
// Tests stay in the Editor repository; they need a real browser.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const source = process.argv[2];
if (!source || !existsSync(path.join(source, 'src', 'lib', 'Editor.svelte'))) {
	console.error('Usage: pnpm editor:sync <path to a checkout of the Editor repository>');
	process.exit(1);
}
const from = path.join(source, 'src', 'lib');
const to = path.resolve('src', 'lib', 'editor');

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
let files = 0;
const copy = (dir) => {
	for (const name of readdirSync(path.join(from, dir))) {
		const rel = path.join(dir, name);
		if (statSync(path.join(from, rel)).isDirectory()) copy(rel);
		else if (!/\.test\.(ts|js)$/.test(name)) {
			mkdirSync(path.dirname(path.join(to, rel)), { recursive: true });
			cpSync(path.join(from, rel), path.join(to, rel));
			files++;
		}
	}
};
copy('');

const git = (...args) => {
	try {
		return execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
	} catch {
		return 'unknown';
	}
};
writeFileSync(
	path.join(to, 'SOURCE.md'),
	`# Article editor (copy)

This folder is a **copy** of the standalone editor from the Editor repository. Do not edit it by hand.
To change it: change the Editor repository, then run \`pnpm editor:sync <path to the Editor checkout>\` here.

- Repository: https://github.com/deodatus-fringilla/editor
- Commit: ${git('rev-parse', 'HEAD')}
- Branch: ${git('rev-parse', '--abbrev-ref', 'HEAD')}
- Files: ${files} (tests are not copied; they live in the Editor repository)
`
);
console.log(`Copied ${files} files to src/lib/editor/ (commit ${git('rev-parse', '--short', 'HEAD')}).`);
