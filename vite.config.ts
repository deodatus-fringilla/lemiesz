import adapter from '@sveltejs/adapter-node';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// The Content-Security-Policy is applied to production builds only: in dev it would block Vite's HMR websocket.
const production = process.argv.includes('build');

// `vite dev` does not copy .env into process.env, but this app reads process.env everywhere (as it does in
// production, where Docker/compose supplies it). Load .env for the dev server only; real environment variables win.
if (process.argv.includes('dev') || process.argv.length <= 2) {
	const fromFile = loadEnv('development', process.cwd(), '');
	for (const [k, v] of Object.entries(fromFile)) if (process.env[k] === undefined) process.env[k] = v;
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// Cookie-based locale, no URL prefixes (internal tool, not an SEO site).
			strategy: ['cookie', 'baseLocale'],
			cookieName: 'locale'
		}),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			...(production && {
				csp: {
					mode: 'auto' as const,
					directives: {
						'default-src': ['self'],
						'script-src': ['self'],
						// Svelte writes inline style attributes (e.g. progress bars)
						'style-src': ['self', 'unsafe-inline'],
						'img-src': ['self', 'data:'],
						'connect-src': ['self'],
						'base-uri': ['self'],
						// Media embeds (Phase 6): privacy-respecting hosts only. Must equal EMBED_HOSTS in src/lib/server/media.ts (ROBOT-09).
						'frame-src': ['https://www.youtube-nocookie.com', 'https://open.spotify.com'],
						'form-action': ['self'],
						'frame-ancestors': ['none']
					}
				}
			})
		})
	],
	test: {
		// Gives every test run its own throw-away database (never ./data).
		setupFiles: ['./vitest.setup.ts'],
		include: ['src/**/*.test.ts']
	}
});
