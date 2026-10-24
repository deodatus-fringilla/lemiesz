import { defineConfig } from 'vitest/config';
import base from './vite.config.ts';

// `pnpm eval`: quality evaluation with the REAL embedder (and the real auditor when configured).
// Slow and network-dependent on first run (model download), so it is kept out of `pnpm test`.
// Runs on a throw-away database loaded from data/baseline.sql (corpus proposal v3.1 §3.3, group 3).
const { test: _unitProjects, ...shared } = base;

export default defineConfig({
	...shared,
	test: {
		setupFiles: ['./vitest.baseline.setup.ts'],
		include: ['src/**/*.eval.ts'],
		exclude: ['**/*.test.ts', '**/node_modules/**'],
		testTimeout: 900_000,
		hookTimeout: 900_000
	}
});
