import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The baseline project: a throw-away database that starts from the committed corpus, data/baseline.sql
// (corpus proposal v3.1 §3.3, group 3). Tests here assert invariants of that corpus, never row counts.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemiesz-test-'));
process.env.DATABASE_PATH = path.join(dir, 'test.db');
process.env.AUTH_DISABLED = 'true';
process.env.DATABASE_BASELINE = './data/baseline.sql';
