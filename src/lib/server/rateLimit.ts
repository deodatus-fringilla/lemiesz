/** In-memory fixed-window rate limiter with pruning (plan §8). */
export class RateLimiter {
	private hits = new Map<string, { count: number; resetAt: number }>();
	private timer: ReturnType<typeof setInterval> | undefined;

	constructor(
		private readonly max: number,
		private readonly windowMs: number
	) {
		this.timer = setInterval(() => this.prune(), Math.max(windowMs, 10_000));
		this.timer.unref?.();
	}

	/** Returns true when the caller is over the limit. */
	limited(key: string, now = Date.now()): boolean {
		const rec = this.hits.get(key);
		if (!rec || now > rec.resetAt) {
			this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
			return false;
		}
		rec.count++;
		return rec.count > this.max;
	}

	prune(now = Date.now()): void {
		for (const [k, v] of this.hits) if (now > v.resetAt) this.hits.delete(k);
	}

	get size(): number {
		return this.hits.size;
	}
}
