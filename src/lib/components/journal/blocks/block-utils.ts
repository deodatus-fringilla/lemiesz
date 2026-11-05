import type { Block, ContentBlock } from '$lib/journal-blocks';

/** In the editor every block carries a client-only key `_k` for stable lists; the server drops unknown fields. */
export type EditorContent = ContentBlock & { _k: string };
export type EditorBlock = EditorContent;
export type BlockType = Block['type'];

let seq = 0;
const key = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

export function newContent(type: BlockType): EditorContent {
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
		case 'media':
			return { type, mediaId: 0, _k: key() };
	}
}

export const newBlock = newContent;

/** Deep copy of saved blocks with fresh editor keys. */
export function withKeys(blocks: Block[]): EditorBlock[] {
	return blocks.map((b) => ({ ...structuredClone(b), _k: key() }) as EditorContent);
}

/** What gets saved: the blocks without editor keys. */
export const toJson = (blocks: EditorBlock[]) => JSON.stringify(blocks, (k, v) => (k === '_k' ? undefined : v));

export function move<T>(list: T[], from: number, to: number): void {
	if (to < 0 || to >= list.length) return;
	const [item] = list.splice(from, 1);
	list.splice(to, 0, item);
}

export const isEmptyBlock = (b: EditorBlock): boolean =>
	b.type === 'separator' || (b.type === 'quote' ? !b.sourceId : b.type === 'image' ? !b.imageId : b.type === 'media' ? !b.mediaId : !('md' in b ? b.md : b.text).trim());
