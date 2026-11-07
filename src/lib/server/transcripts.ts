import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

/**
 * Raw transcripts & intake dossiers (`corpus/intake/**\/*.{md,txt}`).
 * Exposes `corpus/intake/` on the UI level (`/repository?view=transcripts`) while keeping the
 * correspondence archive (`letters_archive/Korona`) in its dedicated `?view=letters` tab.
 */
const INTAKE_DIR = path.resolve(process.env.CORPUS_DIR ?? 'corpus', 'intake');

export interface TranscriptEntry {
	/** Relative path inside `corpus/intake` with forward slashes, e.g. `for_processing/Braun Grzegorz.md` */
	slug: string;
	folder: string;
	filename: string;
	title: string;
	speaker: string | null;
	date: string | null;
	sourceUrl: string | null;
	wordCount: number;
	file: string;
}

export interface TranscriptDetail extends TranscriptEntry {
	body: string;
	html: string;
}

export interface TranscriptInput {
	slug?: string;
	folder: string;
	title: string;
	speaker?: string;
	date?: string;
	sourceUrl?: string;
	body: string;
}

function walkIntake(dir: string, rel = ''): string[] {
	if (!fs.existsSync(dir)) return [];
	const out: string[] = [];
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const nextRel = rel ? `${rel}/${e.name}` : e.name;
		if (nextRel === 'letters_archive/Korona' || nextRel.startsWith('letters_archive/Korona/')) continue;
		const full = path.join(dir, e.name);
		if (e.isDirectory()) out.push(...walkIntake(full, nextRel));
		else if (/\.(md|txt)$/i.test(e.name)) out.push(nextRel);
	}
	return out.sort();
}

function extractMeta(raw: string, filename: string, folder: string): Omit<TranscriptEntry, 'slug' | 'folder' | 'filename' | 'file'> {
	const base = filename.replace(/\.(md|txt)$/i, '');
	const h1 = /^#\s+(.+)$/m.exec(raw)?.[1]?.replace(/[*_`]/g, '').trim();
	const title = h1 || base;
	const dateMatch =
		/-\s*\*\*(?:Data|Date):\*\*\s*(.+)$/im.exec(raw)?.[1]?.trim() ??
		/^(\d{4}-\d{2}-\d{2})/.exec(base)?.[1] ??
		null;
	const speakerMatch =
		/-\s*\*\*(?:Mówca|Speaker|Autor|Author):\*\*\s*(.+)$/im.exec(raw)?.[1]?.trim() ??
		(folder !== 'for_processing' ? folder.split('/').pop() ?? null : base);
	const urlMatch = /https?:\/\/[^\s)>\]"]+/i.exec(raw)?.[0] ?? null;
	const words = raw.trim().split(/\s+/).filter(Boolean).length;
	return { title, speaker: speakerMatch, date: dateMatch, sourceUrl: urlMatch, wordCount: words };
}

function safeSlugPath(slug: string): string | null {
	const clean = slug.replace(/\\/g, '/').replace(/^\/+/, '');
	if (!clean || clean.includes('..') || !/\.(md|txt)$/i.test(clean)) return null;
	const full = path.resolve(INTAKE_DIR, clean);
	if (!full.startsWith(INTAKE_DIR + path.sep)) return null;
	return full;
}

export function listTranscripts(opts: { search?: string; folder?: string } = {}): {
	transcripts: TranscriptEntry[];
	folders: { name: string; count: number }[];
} {
	const files = walkIntake(INTAKE_DIR);
	const needle = opts.search?.trim().toLocaleLowerCase('pl');
	const folderCounts = new Map<string, number>();
	const all: TranscriptEntry[] = [];

	for (const rel of files) {
		const full = path.join(INTAKE_DIR, rel);
		const raw = fs.readFileSync(full, 'utf8');
		const parts = rel.split('/');
		const filename = parts.pop()!;
		const folder = parts.join('/') || 'for_processing';
		folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);

		if (opts.folder && folder !== opts.folder) continue;
		if (needle && !raw.toLocaleLowerCase('pl').includes(needle) && !rel.toLocaleLowerCase('pl').includes(needle)) continue;

		const meta = extractMeta(raw, filename, folder);
		all.push({
			slug: rel,
			folder,
			filename,
			file: `corpus/intake/${rel}`,
			...meta
		});
	}

	const folders = [...folderCounts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => a.name.localeCompare(b.name));

	return { transcripts: all, folders };
}

export function getTranscript(slug: string): TranscriptDetail | null {
	const full = safeSlugPath(slug);
	if (!full || !fs.existsSync(full)) return null;
	const raw = fs.readFileSync(full, 'utf8');
	const clean = slug.replace(/\\/g, '/').replace(/^\/+/, '');
	const parts = clean.split('/');
	const filename = parts.pop()!;
	const folder = parts.join('/') || 'for_processing';
	const meta = extractMeta(raw, filename, folder);
	const html = marked.parse(raw, { async: false }) as string;
	return {
		slug: clean,
		folder,
		filename,
		file: `corpus/intake/${clean}`,
		...meta,
		body: raw,
		html
	};
}

function sanitizeSegment(s: string): string {
	return s
		.trim()
		.replace(/[<>:"|?*\\]/g, '')
		.replace(/\.\.+/g, '')
		.replace(/\s+/g, '_')
		.slice(0, 80);
}

export function saveTranscript(input: TranscriptInput): string {
	const title = input.title.trim();
	const body = input.body.trim();
	if (!title) throw new Error('Title is required');
	if (!body) throw new Error('Transcript content is required');

	let rel = input.slug?.trim();
	if (!rel) {
		const rawFolder = (input.folder.trim() || 'for_processing')
			.split('/')
			.map(sanitizeSegment)
			.filter(Boolean)
			.join('/');
		const folder = rawFolder || 'for_processing';
		const datePrefix = input.date?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(input.date.trim()) ? `${input.date.trim()}_` : '';
		const fileSlug = sanitizeSegment(title) || 'transcript';
		rel = `${folder}/${datePrefix}${fileSlug}.md`;
	}

	const full = safeSlugPath(rel);
	if (!full) throw new Error('Invalid transcript file path');

	let content = body;
	if (!/^#\s+/m.test(content)) {
		const metaLines: string[] = [];
		if (input.speaker?.trim()) metaLines.push(`- **Mówca:** ${input.speaker.trim()}`);
		if (input.date?.trim()) metaLines.push(`- **Data:** ${input.date.trim()}`);
		if (input.sourceUrl?.trim()) metaLines.push(`- **Źródło:** ${input.sourceUrl.trim()}`);
		content = `# ${title}\n\n${metaLines.length ? metaLines.join('\n') + '\n\n---\n\n' : ''}${body}\n`;
	}

	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content, 'utf8');
	return rel.replace(/\\/g, '/');
}

export function deleteTranscript(slug: string): void {
	const full = safeSlugPath(slug);
	if (!full || !fs.existsSync(full)) throw new Error('Transcript not found');
	fs.unlinkSync(full);
}
