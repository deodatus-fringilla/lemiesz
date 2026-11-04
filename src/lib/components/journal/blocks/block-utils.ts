import type { Block, ContentBlock } from '$lib/journal-blocks';

/** In the editor every block carries a client-only key `_k` for stable lists; the server drops unknown fields. */
export type EditorContent = ContentBlock & { _k: string };
export type EditorColumns = { type: 'columns'; columns: EditorBlock[][]; _k: string }; // the UI offers content blocks only inside columns; the server refuses nesting
export type EditorBlock = EditorContent | EditorColumns;
export type ContentType = ContentBlock['type'];
export type BlockType = Block['type'];

let seq = 0;
const key = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

export function newContent(type: ContentType): EditorContent {
	switch (type) {
		case 'text':
			return { type, md: '', _k: key() };
		case 'callout':
			return { type, md: '', _k: key() };
		case 'heading':
			return { type, level: 2, text: '', _k: key() };
		case 'quote':
			return { type, sourceId: 0, _k: key() };
		case 'separator':
			return { type, _k: key() };
		case 'image':
			return { type, imageId: 0, size: 'column', _k: key() };
	}
}

export function newBlock(type: BlockType): EditorBlock {
	if (type === 'columns') return { type, columns: [[newContent('text')], [newContent('text')]], _k: key() };
	return newContent(type);
}

/** Deep copy of saved blocks with fresh editor keys. */
export function withKeys(blocks: Block[]): EditorBlock[] {
	const c = (b: ContentBlock): EditorContent => ({ ...structuredClone(b), _k: key() }) as EditorContent;
	return blocks.map((b) => (b.type === 'columns' ? { type: 'columns', columns: b.columns.map((col) => col.map(c)), _k: key() } : c(b)));
}

/** What gets saved: the blocks without editor keys. */
export const toJson = (blocks: EditorBlock[]) => JSON.stringify(blocks, (k, v) => (k === '_k' ? undefined : v));

export function move<T>(list: T[], from: number, to: number): void {
	if (to < 0 || to >= list.length) return;
	const [item] = list.splice(from, 1);
	list.splice(to, 0, item);
}

/** Changes the number of columns: new columns start with an empty text block; dropped columns move their blocks left. */
export function setColumnCount(block: EditorColumns, n: number): void {
	while (block.columns.length < n) block.columns.push([newContent('text')]);
	while (block.columns.length > n) block.columns[block.columns.length - 2].push(...block.columns.pop()!);
}

export const isEmptyBlock = (b: EditorBlock): boolean =>
	b.type === 'columns'
		? b.columns.every((c) => c.every(isEmptyBlock))
		: b.type === 'separator' || (b.type === 'quote' ? !b.sourceId : b.type === 'image' ? !b.imageId : !('md' in b ? b.md : b.text).trim());
