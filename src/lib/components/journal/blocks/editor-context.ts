import { getContext, setContext } from 'svelte';
import type { JournalImage } from '$lib/server/journal-images';

/** Data every block card may need, without passing it through each level by hand. Getters keep it reactive. */
export interface EditorContext {
	readonly images: JournalImage[];
	readonly locale: string;
}
const KEY = Symbol('journal-block-editor');
export const setEditorContext = (c: EditorContext) => setContext(KEY, c);
export const editorContext = () => getContext<EditorContext>(KEY);
