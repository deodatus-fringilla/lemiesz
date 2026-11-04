// Single source of truth for compiling translations. Used by vite.config.ts (dev server and build) AND by
// `pnpm paraglide` / `pnpm check` (scripts/paraglide.mjs). Both write ./src/lib/paraglide, so they must produce
// identical output: before, the dev server wrote locale-modules with cookie "locale" while the CLI wrote
// message-modules with cookie "PARAGLIDE_LOCALE", and running one under the other broke the app.
/** @type {import('@inlang/paraglide-js').CompilerOptions} */
export const paraglideOptions = {
	project: './project.inlang',
	outdir: './src/lib/paraglide',
	// Cookie-based locale, no URL prefixes (internal tool, not an SEO site).
	strategy: ['cookie', 'baseLocale'],
	cookieName: 'locale',
	// Same structure in dev and build (the plugin would otherwise switch to locale-modules in dev).
	outputStructure: 'message-modules'
};
