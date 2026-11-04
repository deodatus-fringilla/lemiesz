/**
 * Svelte action: highlights every search term inside an element and (optionally) scrolls the first hit into view.
 * It edits the live DOM text nodes (never innerHTML), so it is safe on `{@html}` content, and it matches
 * case- and diacritics-insensitively (so "niedzwiedz" finds "Niedźwiedź").
 */
export interface HighlightParams {
	query: string;
	/** Change this when the content changes without the query changing (e.g. a different entry). */
	key?: unknown;
	/** Scroll the first match to the middle of its scroll container. */
	scroll?: boolean;
	/** Receives the marks (in document order) so a UI can step through them; it then owns the scrolling. */
	nav?: { attach(marks: HTMLElement[], scroll: boolean): void };
}

const MARK_CLASS = 'rounded-sm bg-amber-400/40 px-0.5 text-amber-50 ring-1 ring-amber-400/60';

/** Folds text for matching and records which original index each folded char came from. */
function fold(text: string): { folded: string; origin: number[] } {
	let folded = '';
	const origin: number[] = [];
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		const out = /[łŁ]/.test(ch) ? 'l' : ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
		for (const c of out) {
			folded += c;
			origin.push(i);
		}
	}
	return { folded, origin };
}

function buildMatcher(query: string): RegExp | null {
	const terms = fold(query.replace(/["*()]/g, ' ')).folded
		.split(/\s+/)
		.filter((t) => t.length >= 2)
		.sort((a, b) => b.length - a.length)
		.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	return terms.length ? new RegExp(terms.join('|'), 'g') : null;
}

function clear(root: HTMLElement) {
	const marks = root.querySelectorAll('mark[data-hl]');
	marks.forEach((m) => m.replaceWith(document.createTextNode(m.textContent ?? '')));
	if (marks.length) root.normalize();
}

function apply(root: HTMLElement, re: RegExp): HTMLElement | null {
	const texts: Text[] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);

	let first: HTMLElement | null = null;
	for (const node of texts) {
		const { folded, origin } = fold(node.data);
		const ranges = [...folded.matchAll(re)].map((m) => [origin[m.index], origin[m.index + m[0].length - 1] + 1]);
		// Split from the end so earlier offsets stay valid.
		for (let i = ranges.length - 1; i >= 0; i--) {
			const [start, end] = ranges[i];
			const hit = node.splitText(start);
			hit.splitText(end - start);
			const mark = document.createElement('mark');
			mark.dataset.hl = '';
			mark.className = MARK_CLASS;
			hit.replaceWith(mark);
			mark.appendChild(hit);
			first = mark;
		}
	}
	// `first` is the last one created (we walk backwards inside a node); resolve the true first in document order.
	return root.querySelector('mark[data-hl]') ?? first;
}

/** Centres the match inside its nearest scrollable ancestor only, so the page itself never jumps. */
export function scrollToMatch(mark: HTMLElement) {
	let box = mark.parentElement;
	while (box && !(box.scrollHeight > box.clientHeight && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) {
		box = box.parentElement;
	}
	// No scrolling panel (the text already fits): leave everything where it is. Falling back to
	// scrollIntoView here would scroll the whole page and push the search box off-screen.
	if (!box) return;
	const offset = mark.getBoundingClientRect().top - box.getBoundingClientRect().top;
	box.scrollTo({ top: box.scrollTop + offset - box.clientHeight / 2, behavior: 'smooth' });
}

export function highlight(node: HTMLElement, initial: HighlightParams) {
	let params = initial;

	function run(scroll: boolean) {
		clear(node);
		const re = params.query ? buildMatcher(params.query) : null;
		const first = re ? apply(node, re) : null;
		if (params.nav) params.nav.attach([...node.querySelectorAll<HTMLElement>('mark[data-hl]')], scroll);
		else if (first && scroll) requestAnimationFrame(() => scrollToMatch(first));
	}

	run(!!params.scroll);
	return {
		update(next: HighlightParams) {
			const same = next.query === params.query && next.key === params.key;
			params = next;
			// A data refresh (e.g. ticking a task) re-runs the action with equal params: keep marks and position.
			if (same && node.querySelector('mark[data-hl]')) return;
			run(!same && !!params.scroll);
		},
		destroy() {
			clear(node);
		}
	};
}
