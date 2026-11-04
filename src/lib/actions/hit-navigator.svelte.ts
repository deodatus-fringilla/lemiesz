import { scrollToMatch } from './highlight';

const ACTIVE = ['bg-amber-400/80', 'text-zinc-950', 'ring-2', 'ring-amber-200'];

/** Steps through the matches the `highlight` action found: "hit 2 of 5" with previous / next. */
export class HitNavigator {
	count = $state(0);
	index = $state(0);
	#marks: HTMLElement[] = [];

	/** Called by the highlight action with the marks in document order. */
	attach(marks: HTMLElement[], scroll: boolean) {
		this.#marks = marks;
		this.count = marks.length;
		this.index = 0;
		if (marks.length) this.#activate(scroll);
	}

	next() {
		this.go(this.index + 1);
	}
	prev() {
		this.go(this.index - 1);
	}
	/** Wraps around at both ends. */
	go(i: number) {
		if (!this.count) return;
		this.#marks[this.index]?.classList.remove(...ACTIVE);
		this.index = ((i % this.count) + this.count) % this.count;
		this.#activate(true);
	}

	#activate(scroll: boolean) {
		const mark = this.#marks[this.index];
		if (!mark?.isConnected) return;
		mark.classList.add(...ACTIVE);
		if (scroll) requestAnimationFrame(() => scrollToMatch(mark));
	}
}
