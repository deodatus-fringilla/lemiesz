/**
 * Toolbar edits on a Markdown textarea, as pure functions: given the text and the selection, return the new text and
 * the new selection. Keeps the toolbar testable and free of DOM details.
 */
export interface Edit {
	value: string;
	start: number;
	end: number;
}

/** Wraps the selection (or a placeholder when nothing is selected) in `before` … `after`; the inner text stays selected. */
export function wrap(value: string, start: number, end: number, before: string, after: string, placeholder: string): Edit {
	const inner = value.slice(start, end) || placeholder;
	const next = value.slice(0, start) + before + inner + after + value.slice(end);
	return { value: next, start: start + before.length, end: start + before.length + inner.length };
}

/** Puts a marker ("- ", "1. ") in front of every line touched by the selection; numbered lists count up. */
export function prefixLines(value: string, start: number, end: number, kind: 'bullet' | 'numbered'): Edit {
	const lineStart = value.lastIndexOf('\n', start - 1) + 1;
	const nl = value.indexOf('\n', end);
	const lineEnd = nl === -1 ? value.length : nl;
	const lines = value.slice(lineStart, lineEnd).split('\n');
	const marked = lines.map((l, i) => (kind === 'bullet' ? `- ${l}` : `${i + 1}. ${l}`)).join('\n');
	return { value: value.slice(0, lineStart) + marked + value.slice(lineEnd), start: lineStart, end: lineStart + marked.length };
}

/** Inserts text at the cursor (replacing any selection) and puts the cursor after it. */
export function insertAt(value: string, start: number, end: number, text: string): Edit {
	const next = value.slice(0, start) + text + value.slice(end);
	return { value: next, start: start + text.length, end: start + text.length };
}
