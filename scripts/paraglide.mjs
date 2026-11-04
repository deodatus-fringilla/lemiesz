// `pnpm paraglide` — compiles translations with exactly the options the Vite plugin uses (paraglide.config.js).
import { compile } from '@inlang/paraglide-js';
import { paraglideOptions } from '../paraglide.config.js';

await compile(paraglideOptions);
