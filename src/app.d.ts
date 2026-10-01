import type { SessionUser } from '$lib/server/auth';

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
			locale: string;
		}
	}
}

export {};
