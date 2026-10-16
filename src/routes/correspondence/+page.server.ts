import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const mode = url.searchParams.get('mode');
	redirect(307, mode === 'deconstruct' ? '/shield?tab=deconstruct' : '/shield?tab=dossier');
};
