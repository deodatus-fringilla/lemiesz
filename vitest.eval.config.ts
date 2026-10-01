import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vite.config.ts';

// `pnpm eval`: quality evaluation with the REAL embedder (and the real auditor when configured).
// Slow and network-dependent on first run (model download), so it is kept out of `pnpm test`.
export default mergeConfig(
	base,
	defineConfig({
		test: {
			include: ['src/**/*.eval.ts'],
			exclude: ['**/*.test.ts', '**/node_modules/**'],
			testTimeout: 900_000,
			hookTimeout: 900_000
		}
	})
);
