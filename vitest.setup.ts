import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Must run before any module imports `$lib/server/db`, so tests never touch ./data.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemiesz-test-'));
process.env.DATABASE_PATH = path.join(dir, 'test.db');
process.env.AUTH_DISABLED = 'true';
