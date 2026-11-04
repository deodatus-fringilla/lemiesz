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
	| { type: 'separator' };

/** Columns hold content blocks only: one level deep, never columns inside columns. */
export type ColumnsBlock = { type: 'columns'; columns: ContentBlock[][] };
export type Block = ContentBlock | ColumnsBlock;

export const BLOCK_LIMITS = {
	blocks: 400, // all blocks, counting those inside columns
	columns: [2, 3] as readonly number[],
	blocksPerColumn: 100,
	mdChars: 60_000,
	headingChars: 300,
	totalChars: 400_000
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
