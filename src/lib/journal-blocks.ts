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

/** Columns hold content blocks only: one level deep, never columns inside columns. */
export type ColumnsBlock = { type: 'columns'; columns: ContentBlock[][] };
export type Block = ContentBlock | ColumnsBlock;

export const BLOCK_LIMITS = {
	blocks: 400, // all blocks, counting those inside columns
	columns: [2, 3] as readonly number[],
	blocksPerColumn: 100,
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
	const blocks = input.map((b, i): Block => {
		const where = `Block ${i + 1}`;
		if (isObj(b) && b.type === 'columns') {
			count++;
			const cols = b.columns;
			if (!Array.isArray(cols) || !BLOCK_LIMITS.columns.includes(cols.length)) throw new BlockError(`${where}: columns must be 2 or 3`);
			return {
				type: 'columns',
				columns: cols.map((col, c) => {
					if (!Array.isArray(col)) throw new BlockError(`${where}, column ${c + 1}: not a list`);
					if (col.length > BLOCK_LIMITS.blocksPerColumn) throw new BlockError(`${where}, column ${c + 1}: too many blocks`);
					return col.map((x, k) => content(x, `${where}, column ${c + 1}, block ${k + 1}`));
				})
			};
		}
		return content(b, where);
	});
	if (count > BLOCK_LIMITS.blocks) throw new BlockError(`An article may have at most ${BLOCK_LIMITS.blocks} blocks`);
	if (chars > BLOCK_LIMITS.totalChars) throw new BlockError('The article is too long');
	if (!opts.allowEmpty && !blocks.some(hasContent)) throw new BlockError('The article is empty');
	return blocks;
}

function hasContent(b: Block): boolean {
	if (b.type === 'columns') return b.columns.some((c) => c.some(hasContent));
	if (b.type === 'text' || b.type === 'callout') return b.md.trim().length > 0;
	return b.type !== 'separator';
}

/** Every media block, wherever it sits (columns included). */
export function mediaBlocks(blocks: Block[]): Extract<ContentBlock, { type: 'media' }>[] {
	return blocks.flatMap((b) => (b.type === 'columns' ? b.columns.flat() : [b])).filter((b): b is Extract<ContentBlock, { type: 'media' }> => b.type === 'media');
}

/** Every image block, wherever it sits (columns included). */
export function imageBlocks(blocks: Block[]): Extract<ContentBlock, { type: 'image' }>[] {
	return blocks.flatMap((b) => (b.type === 'columns' ? b.columns.flat() : [b])).filter((b): b is Extract<ContentBlock, { type: 'image' }> => b.type === 'image');
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
				return b.md.trim();
			case 'heading':
				return `${'#'.repeat(b.level)} ${b.text}`;
			case 'quote':
				return `[[quote:${b.sourceId}]]`;
			case 'separator':
				return '---';
			case 'image':
			case 'media':
				return b.caption ?? '';
			case 'columns':
				return b.columns.map((c) => c.map(one).filter(Boolean).join('\n\n')).join('\n\n');
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
