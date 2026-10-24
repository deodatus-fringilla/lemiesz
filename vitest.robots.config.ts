import { defineConfig } from 'vitest/config';
import base from './vite.config.ts';

// `pnpm robots`: the Robot Fleet's Vitest-based gates (docs/17_Robots). Each robot is one file in tests/robots.
// The base config's `test` (the unit/baseline projects) is replaced, not merged, so no unit test runs here.
// Corpus proposal v3.1 §3.3: robots that build their own fixtures start EMPTY; robots that judge the committed
// corpus (04, 07, 09, 10) start from data/baseline.sql.
const BASELINE_ROBOTS = ['04', '07', '09', '10'].map((n) => `tests/robots/robot-${n}-*.robot.ts`);
const { test: _unitProjects, ...shared } = base;

export default defineConfig({
	...shared,
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'robots',
					setupFiles: ['./vitest.setup.ts'],
					include: ['tests/robots/**/*.robot.ts'],
					exclude: [...BASELINE_ROBOTS, '**/node_modules/**']
				}
			},
			{
				extends: true,
				test: { name: 'robots-baseline', setupFiles: ['./vitest.baseline.setup.ts'], include: BASELINE_ROBOTS }
			}
		]
	}
});
