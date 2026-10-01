import { redirect, type RequestHandler } from '@sveltejs/kit';
import { SESSION_COOKIE, deleteSession } from '$lib/server/auth';

export const POST: RequestHandler = ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) deleteSession(token);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	redirect(303, '/login');
};
