import { describe, expect, it, vi } from 'vitest';
import { HitNavigator } from './hit-navigator.svelte';

const fakeMark = () => {
	const classes = new Set<string>();
	return {
		isConnected: true,
		classList: { add: (...c: string[]) => c.forEach((x) => classes.add(x)), remove: (...c: string[]) => c.forEach((x) => classes.delete(x)) },
		active: () => classes.size > 0
	};
};

describe('HitNavigator', () => {
	it('counts hits, marks the current one and wraps around in both directions', () => {
		vi.stubGlobal('requestAnimationFrame', () => 0);
		const marks = [fakeMark(), fakeMark(), fakeMark()];
		const nav = new HitNavigator();
		nav.attach(marks as unknown as HTMLElement[], false);
		expect([nav.count, nav.index]).toEqual([3, 0]);
		expect(marks.map((m) => m.active())).toEqual([true, false, false]);
		nav.next();
		nav.next();
		expect(nav.index).toBe(2);
		expect(marks.map((m) => m.active())).toEqual([false, false, true]);
		nav.next();
		expect(nav.index).toBe(0);
		nav.prev();
		expect(nav.index).toBe(2);
		nav.attach([], false);
		expect(nav.count).toBe(0);
		nav.next();
		expect(nav.index).toBe(0);
		vi.unstubAllGlobals();
	});
});
