import { m } from '$lib/paraglide/messages.js';
import type { BlockType } from './block-utils';

export function blockLabel(t: BlockType): string {
	const l: Record<BlockType, () => string> = {
		text: m.blocks_type_text,
		heading: m.blocks_type_heading,
		quote: m.blocks_type_quote,
		callout: m.blocks_type_callout,
		separator: m.blocks_type_separator,
		image: m.blocks_type_image,
		media: m.blocks_type_media
	};
	return l[t]();
}
