import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vite.config.ts';

// `pnpm robots`: the Robot Fleet's Vitest-based gates (docs/17_Robots). Each robot is one file in tests/robots.
// Like `pnpm eval`, merging concatenates `include`, so the regular unit tests are excluded explicitly.
export default mergeConfig(
	base,
	defineConfig({
		test: {
			include: ['tests/robots/**/*.robot.ts'],
			exclude: ['**/*.test.ts', '**/node_modules/**']
		}
	})
);
