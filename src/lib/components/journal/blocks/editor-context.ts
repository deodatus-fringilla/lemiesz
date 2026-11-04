import { getContext, setContext } from 'svelte';
import type { JournalImage } from '$lib/server/journal-images';
import type { EditorMedia } from '$lib/server/journal-media';

/** Data every block card may need, without passing it through each level by hand. Getters keep it reactive. */
export interface EditorContext {
	readonly images: JournalImage[];
	readonly media: EditorMedia[];
	readonly locale: string;
}
const KEY = Symbol('journal-block-editor');
export const setEditorContext = (c: EditorContext) => setContext(KEY, c);
export const editorContext = () => getContext<EditorContext>(KEY);
