import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	SESSION_COOKIE,
	UserError,
	changeOwnPassword,
	createUser,
	deleteUser,
	listUsers,
	setPassword
} from '$lib/server/auth';

const str = (d: FormData, k: string) => String(d.get(k) ?? '');
const isAdmin = (locals: App.Locals) => locals.user?.role === 'admin';

export const load: PageServerLoad = ({ locals }) => ({
	me: locals.user,
	users: isAdmin(locals) ? listUsers() : []
});

const message = (e: unknown) => (e instanceof UserError || e instanceof Error ? e.message : 'Error');

export const actions: Actions = {
	/** Everyone can change their own password; other sessions of that user are signed out. */
	changePassword: async ({ request, locals, cookies }) => {
		const d = await request.formData();
		if (str(d, 'next') !== str(d, 'confirm')) return fail(400, { action: 'changePassword', errors: ['mismatch'] });
		try {
			changeOwnPassword(locals.user!.id, str(d, 'current'), str(d, 'next'), cookies.get(SESSION_COOKIE));
			return { action: 'changePassword', ok: true };
		} catch (e) {
			return fail(400, { action: 'changePassword', errors: [message(e)] });
		}
	},

	createUser: async ({ request, locals }) => {
		if (!isAdmin(locals)) return fail(403, { action: 'createUser', errors: ['Admin only'] });
		const d = await request.formData();
		try {
			createUser(str(d, 'username'), str(d, 'password'), str(d, 'role') === 'admin' ? 'admin' : 'member');
			return { action: 'createUser', ok: true };
		} catch (e) {
			const dup = /UNIQUE/i.test((e as Error).message);
			return fail(400, { action: 'createUser', errors: [dup ? 'Username already exists' : message(e)] });
		}
	},

	resetPassword: async ({ request, locals }) => {
		if (!isAdmin(locals)) return fail(403, { action: 'resetPassword', errors: ['Admin only'] });
		const d = await request.formData();
		try {
			setPassword(str(d, 'userId'), str(d, 'password'));
			return { action: 'resetPassword', ok: true };
		} catch (e) {
			return fail(400, { action: 'resetPassword', errors: [message(e)] });
		}
	},

	deleteUser: async ({ request, locals }) => {
		if (!isAdmin(locals)) return fail(403, { action: 'deleteUser', errors: ['Admin only'] });
		const d = await request.formData();
		try {
			deleteUser(str(d, 'userId'), locals.user!.id);
			return { action: 'deleteUser', ok: true };
		} catch (e) {
			return fail(400, { action: 'deleteUser', errors: [message(e)] });
		}
	}
};
