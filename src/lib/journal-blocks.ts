/**
 * Journal article format (D-lite): an article is a list of blocks. Text inside text and highlight blocks is Markdown
 * with the platform's citation tokens. Shared by server (validation, rendering) and client (the block editor).
 * Image and media blocks arrive in steps 3 and 4.
 */
export type HeadingLevel = 2 | 3 | 4;

export type ContentBlock =
	| { type: 'text'; md: string }
	| { type: 'heading'; level: HeadingLevel; text: string }
	| { type: 'quote'; sourceId: number }
	| { type: 'callout'; md: string }
	| { type: 'separator' }
	| { type: 'image'; imageId: number; size: ImageSize; caption?: string }
	| { type: 'media'; mediaId: number; caption?: string };

/** column = the width of the text; wide = the article's full width; full = edge to edge of the screen. */
export const IMAGE_SIZES = ['column', 'wide', 'full'] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

/**
 * An article is a flat list of content blocks. Its layout (one or two columns) is a setting of the whole text, not a
 * block: the text flows from the first column into the second. Articles saved before that had a `columns` block;
 * `validateBlocks` still reads one, but puts its contents in a row (see below), so none is ever lost.
 */
export type Block = ContentBlock;
export type LayoutColumns = 1 | 2;
export const isLayoutColumns = (v: unknown): v is LayoutColumns => v === 1 || v === 2;

export const BLOCK_LIMITS = {
	blocks: 400,
	mdChars: 60_000,
	headingChars: 300,
	captionChars: 600,
	// ~75 pages. Kept well below the server's 512 KB request limit (Polish letters take 2 bytes, JSON adds escapes).
	totalChars: 150_000
};

export class BlockError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Turns untrusted input (a saved form, an old row) into well-formed blocks, or throws a BlockError naming the first
 * problem. Unknown fields are dropped, so nothing unexpected is ever stored or rendered.
 * An old `columns` block (2 or 3 lists of blocks) is replaced by the blocks of its columns, in reading order.
 */
/** `allowEmpty`: a draft may have no content yet (approval checks for content separately). */
export function validateBlocks(input: unknown, opts: { allowEmpty?: boolean } = {}): Block[] {
	if (!Array.isArray(input)) throw new BlockError('Blocks must be a list');
	let count = 0;
	let chars = 0;
	const text = (v: unknown, max: number, what: string): string => {
		if (typeof v !== 'string') throw new BlockError(`${what} must be text`);
		if (v.length > max) throw new BlockError(`${what} is longer than ${max} characters`);
		chars += v.length;
		return v;
	};
	const content = (b: unknown, where: string): ContentBlock => {
		count++;
		if (!isObj(b)) throw new BlockError(`${where}: not a block`);
		switch (b.type) {
			case 'text':
				return { type: 'text', md: text(b.md, BLOCK_LIMITS.mdChars, `${where} text`) };
			case 'callout':
				return { type: 'callout', md: text(b.md, BLOCK_LIMITS.mdChars, `${where} highlight`) };
			case 'heading': {
				if (b.level !== 2 && b.level !== 3 && b.level !== 4) throw new BlockError(`${where}: heading level must be 2, 3 or 4`);
				const t = text(b.text, BLOCK_LIMITS.headingChars, `${where} heading`).trim();
				if (!t) throw new BlockError(`${where}: heading is empty`);
				return { type: 'heading', level: b.level, text: t };
			}
			case 'quote':
				if (!Number.isInteger(b.sourceId) || (b.sourceId as number) <= 0) throw new BlockError(`${where}: quotation needs a source`);
				return { type: 'quote', sourceId: b.sourceId as number };
			case 'separator':
				return { type: 'separator' };
			case 'image': {
				if (!Number.isInteger(b.imageId) || (b.imageId as number) <= 0) throw new BlockError(`${where}: image needs a picture`);
				const size = (IMAGE_SIZES as readonly string[]).includes(b.size as string) ? (b.size as ImageSize) : 'column';
				const caption = b.caption === undefined || b.caption === null ? '' : text(b.caption, BLOCK_LIMITS.captionChars, `${where} caption`).trim();
				return caption ? { type: 'image', imageId: b.imageId as number, size, caption } : { type: 'image', imageId: b.imageId as number, size };
			}
			case 'media': {
				if (!Number.isInteger(b.mediaId) || (b.mediaId as number) <= 0) throw new BlockError(`${where}: media needs an item from the library`);
				const caption = b.caption === undefined || b.caption === null ? '' : text(b.caption, BLOCK_LIMITS.captionChars, `${where} caption`).trim();
				return caption ? { type: 'media', mediaId: b.mediaId as number, caption } : { type: 'media', mediaId: b.mediaId as number };
			}
			case 'columns':
				throw new BlockError(`${where}: columns cannot be placed inside columns`);
			default:
				throw new BlockError(`${where}: unknown block type "${String(b.type)}"`);
		}
	};
	const blocks = input.flatMap((b, i): Block[] => {
		const where = `Block ${i + 1}`;
		if (isObj(b) && b.type === 'columns') {
			count++;
			const cols = b.columns;
			if (!Array.isArray(cols) || cols.length < 2 || cols.length > 3) throw new BlockError(`${where}: columns must be 2 or 3`);
			return cols.flatMap((col, c) => {
				if (!Array.isArray(col)) throw new BlockError(`${where}, column ${c + 1}: not a list`);
				return col.map((x, k) => content(x, `${where}, column ${c + 1}, block ${k + 1}`));
			});
		}
		return [content(b, where)];
	});
	if (count > BLOCK_LIMITS.blocks) throw new BlockError(`An article may have at most ${BLOCK_LIMITS.blocks} blocks`);
	if (chars > BLOCK_LIMITS.totalChars) throw new BlockError('The article is too long');
	if (!opts.allowEmpty && !blocks.some(hasContent)) throw new BlockError('The article is empty');
	return blocks;
}

function hasContent(b: Block): boolean {
	if (b.type === 'text' || b.type === 'callout') return b.md.trim().length > 0;
	return b.type !== 'separator';
}

/**
 * The article editor writes an image into text as a line of its own: `![alt](src "caption"){.left}`. The address is
 * that of a library image (campaign_posters); everything readers see about it (picture, description, credit, licence)
 * comes from the library, never from this line, so nothing written here can show a picture the library has not approved.
 * `prefix` holds the `> ` of an image inside a quotation.
 */
const IMAGE_LINE = String.raw`^((?: {0,3}> ?)* {0,3})!\[((?:[^\]\\]|\\.)*)\]\(([^\s)]+)(?: "((?:[^"\\]|\\.)*)")?\)(?:\{\.([a-z]+)\})?[ \t]*$`;
export const imageLineRegExp = () => new RegExp(IMAGE_LINE, 'gm');

const unescapeMd = (s: string) => s.replace(/\\(.)/g, '$1');

/** Where an inline image floats; none means it stands on its own line, centred. */
export type InlinePlace = 'left' | 'right';

export interface InlineImage {
	src: string;
	caption: string;
	place?: InlinePlace;
}

/** The inline images of one Markdown text, in order. */
export function inlineImages(md: string): InlineImage[] {
	return [...md.matchAll(imageLineRegExp())].map((m) => ({
		src: m[3],
		caption: unescapeMd(m[4] ?? ''),
		...(m[5] === 'left' || m[5] === 'right' ? { place: m[5] as InlinePlace } : {})
	}));
}

/** Every Markdown text of an article (text and highlight blocks). */
function markdownTexts(blocks: Block[]): string[] {
	return blocks.flatMap((b) => (b.type === 'text' || b.type === 'callout' ? [b.md] : []));
}

/** Every inline image of an article, wherever it sits. */
export const inlineImagesOf = (blocks: Block[]): InlineImage[] => markdownTexts(blocks).flatMap(inlineImages);

/** The same Markdown with each image line replaced by its caption (what search and the feed should see). */
export const withoutImageLines = (md: string): string => md.replace(imageLineRegExp(), (_m, _prefix, _alt, _src, caption) => unescapeMd(caption ?? '')).replace(/\n{3,}/g, '\n\n');

/** Every media block. */
export function mediaBlocks(blocks: Block[]): Extract<ContentBlock, { type: 'media' }>[] {
	return blocks.filter((b): b is Extract<ContentBlock, { type: 'media' }> => b.type === 'media');
}

/** Every image block. */
export function imageBlocks(blocks: Block[]): Extract<ContentBlock, { type: 'image' }>[] {
	return blocks.filter((b): b is Extract<ContentBlock, { type: 'image' }> => b.type === 'image');
}

/** A Markdown body (articles written before blocks existed, or the plain editor) as blocks. */
export const blocksFromMarkdown = (md: string): Block[] => [{ type: 'text', md }];

/**
 * The article as one Markdown text, derived from the blocks and never edited directly: it feeds search, RSS, citation
 * checks and the plain editor. Quotation blocks become [[quote:ID]] so their sources are checked like any citation.
 */
export function flattenBlocks(blocks: Block[]): string {
	const one = (b: Block): string => {
		switch (b.type) {
			case 'text':
			case 'callout':
				return withoutImageLines(b.md).trim();
			case 'heading':
				return `${'#'.repeat(b.level)} ${b.text}`;
			case 'quote':
				return `[[quote:${b.sourceId}]]`;
			case 'separator':
				return '---';
			case 'image':
			case 'media':
				return b.caption ?? '';
		}
	};
	return blocks.map(one).filter(Boolean).join('\n\n');
}

/** Reads stored blocks; a missing or unreadable value falls back to the Markdown body, so no article ever disappears. */
export function parseStoredBlocks(json: string | null, fallbackMd: string | null): Block[] {
	if (json) {
		try {
			return validateBlocks(JSON.parse(json), { allowEmpty: true });
		} catch {
			// fall through to the body
		}
	}
	return blocksFromMarkdown(fallbackMd ?? '');
}
