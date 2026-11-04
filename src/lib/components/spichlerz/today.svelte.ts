/** Local calendar date as YYYY-MM-DD. */
export function localISODate(d = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Today's date that follows the clock: it rolls over at midnight and is re-checked when the tab becomes
 * visible again (timers sleep in background tabs), so due-date groups never go stale on a long-open page.
 */
class Today {
	#value = $state(localISODate());

	constructor() {
		if (typeof window === 'undefined') return;
		setInterval(() => this.refresh(), 60_000);
		document.addEventListener('visibilitychange', () => this.refresh());
	}

	get value(): string {
		// On the server every request asks afresh; the module lives for the whole process.
		return typeof window === 'undefined' ? localISODate() : this.#value;
	}

	refresh() {
		const now = localISODate();
		if (now !== this.#value) this.#value = now;
	}
}

export const today = new Today();
