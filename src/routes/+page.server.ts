import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createBackup } from '$lib/server/backup';
import { collectDashboard } from '$lib/server/health';

export const load: PageServerLoad = ({ locals }) => ({
	dash: collectDashboard(),
	isAdmin: locals.user?.role === 'admin'
});

export const actions: Actions = {
	/** Takes a verified backup now. Admin only. */
	backup: async ({ locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { errors: ['Admin only'] });
		try {
			const b = await createBackup();
			return { backedUp: b.file };
		} catch (e) {
			return fail(500, { errors: [(e as Error).message] });
		}
	}
};
