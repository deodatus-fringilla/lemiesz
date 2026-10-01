# ROBOT 06 — The SQLite Disk & WAL Assertion Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: OPEN FOR DISCUSSION & CONSULTATION.**
> Fleet Index: [README](README.md) · Live Status: [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md)

| Attribute | Specification |
|---|---|
| **Number** | 06 |
| **Tier** | Backend / Database Init |
| **Source** | `src/lib/server/db/index.ts` & `tests/db.test.ts` |
| **Guards** | SQLite WAL integrity, prevention of database corruption on network drives |
| **Proves it can fail** | Sabotage test: mock UNC path rejected with startup abort error |

---

## 1. Why This Exists

SQLite running in Write-Ahead Logging (WAL) mode requires POSIX shared-memory primitives (`shm`) or Windows file lock semantics that are **not supported on network drives, SMB/CIFS mounts, or UNC shares** (e.g. `\\server\share\lemiesz.db`). Running SQLite WAL across a network share silently corrupts the database, leading to permanent data loss.
Furthermore, without `busy_timeout = 5000`, concurrent transactions under load throw `SQLITE_BUSY` errors rather than waiting for reader locks to clear.

ROBOT-06 enforces at boot time that the database path is physically verified to reside on a local block device, and that critical pragma invariants are active.

---

## 2. Invariant Rules

1. **Local Disk Assertion:** On Windows, paths starting with `\\` (UNC) or mapped network drives must throw an immediate fatal error during DB initialization, preventing the server from starting.
2. **Mandatory PRAGMAs:**
   - `PRAGMA journal_mode = WAL;` (must return `'wal'`).
   - `PRAGMA busy_timeout = 5000;` (must return `5000`).
   - `PRAGMA foreign_keys = ON;` (must return `1`).
3. **Graceful Throw-Away for Testing:** In testing environments, `DB_PATH=:memory:` or temporary throw-away files must isolate tests so production/dev databases are never touched.

---

## 3. Proof It Can Fail

- **Negative Control:** Pass `DB_PATH=\\remote-server\share\lemiesz.db` into `initDb()`.
- **Assertion:** Database initialization throws `NetworkStorageProhibitedError`, failing server launch.
