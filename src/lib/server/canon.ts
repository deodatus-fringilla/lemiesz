import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

/**
 * The doctrinal canons (corpus/canon/*.md, corpus proposal v3.1 §2). Read-only in the app: they are edited in Git,
 * so the reader shows them as they are committed. The files are part of the repository (and of the Docker image),
 * never user input, which is why their Markdown may be rendered as HTML.
 */
const CANON_DIR = path.resolve(process.env.CORPUS_DIR ?? 'corpus', 'canon');

export interface CanonEntry {
	/** File name without `.md`, e.g. "06_Dekonstrukcja_Mitu_Niepodleglosci_i_Prawdziwa_Suwerennosc". */
	slug: string;
	/** "06" */
	number: string;
	title: string;
	file: string;
}

function titleOf(md: string, fallback: string): string {
	return /^#\s+(.+)$/m.exec(md)?.[1].replace(/[*_`]/g, '').trim() ?? fallback;
}

export function listCanons(search?: string): CanonEntry[] {
	if (!fs.existsSync(CANON_DIR)) return [];
	const needle = search?.trim().toLocaleLowerCase('pl');
	return fs
		.readdirSync(CANON_DIR)
		.filter((f) => /^\d{2}_.+\.md$/.test(f))
		.sort()
		.flatMap((f) => {
			const md = fs.readFileSync(path.join(CANON_DIR, f), 'utf8');
			if (needle && !md.toLocaleLowerCase('pl').includes(needle)) return [];
			const slug = f.slice(0, -3);
			return [{ slug, number: f.slice(0, 2), title: titleOf(md, slug), file: `corpus/canon/${f}` }];
		});
}

/** One canon as rendered HTML. Only names returned by listCanons() resolve: no path from the URL reaches the disk. */
export function getCanon(slug: string): (CanonEntry & { html: string }) | null {
	const entry = listCanons().find((c) => c.slug === slug);
	if (!entry) return null;
	const md = fs.readFileSync(path.join(CANON_DIR, `${slug}.md`), 'utf8');
	return { ...entry, html: marked.parse(md, { async: false }) };
}
