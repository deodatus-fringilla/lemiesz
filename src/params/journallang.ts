import type { ParamMatcher } from '@sveltejs/kit';

/** Public journal URLs: Polish has no prefix (/czasopismo), English is /en/czasopismo. */
export const match: ParamMatcher = (param) => param === 'en';
