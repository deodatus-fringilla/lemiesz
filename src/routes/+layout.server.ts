import type { LayoutServerLoad } from './$types';
import { reviewQueue } from '$lib/server/pipeline/queue';

export const load: LayoutServerLoad = ({ locals }) => ({
	user: locals.user ? { username: locals.user.username, role: locals.user.role } : null,
	locale: locals.locale,
	queueCount: locals.user ? reviewQueue().length : 0
});

