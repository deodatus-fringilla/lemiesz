# ROBOT 06 — The SQLite Disk & WAL Assertion Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: IMPLEMENTED (2026-10-01).** Live pass/fail lives in the [Harness Ledger](../10_Harness/02_Harness_Ledger.md).
> Fleet Index: [README](README.md)

| Attribute | Specification |
|---|---|
| **Number** | 06 |
| **Tier** | Backend (Vitest, offline) |
| **Guarded code** | `src/lib/server/db.ts` (`assertLocalFilesystem` and the connection pragmas) |
| **Executable** | `tests/robots/robot-06-sqlite-disk.robot.ts` |
| **Run** | `pnpm robots` · sabotage proof: `pnpm robots:sabotage` |
| **Guards** | SQLite WAL integrity, prevention of corruption on network storage |
| **Proves it can fail** | Mutation proof (2 mutations) and a UNC-path fixture, see §3 |

---

## 1. Why This Exists

WAL mode needs real file locking and shared memory, which network drives, SMB/CIFS shares and UNC paths (`\\server\share\lemiesz.db`) do not reliably provide: running WAL there can silently corrupt the database. Without `busy_timeout`, concurrent writers fail instantly with `SQLITE_BUSY`.

---

## 2. Invariant Rules

1. **Local disk assertion.** `assertLocalFilesystem(path)` throws a `[FATAL]` error for UNC paths (`\\host\share`, `//host/share`) on every platform. On Linux it also rejects paths whose longest-matching mount in `/proc/mounts` is a network filesystem (nfs, cifs, smb, 9p, sshfs and others). `:memory:` and local paths pass. The module runs the check at import, so the server cannot start.
2. **Pragmas.** The live connection has `journal_mode = wal`, `busy_timeout = 5000`, `foreign_keys = 1` (asserted on the test connection).
3. **Isolation.** Tests use a throw-away database in the temp directory (`vitest.setup.ts`), never `./data`.

### Known limits (an earlier draft of this spec overstated them)

* Startup does **not** abort if SQLite refuses WAL or the pragmas fail to apply; the code sets them and moves on. Only the path check aborts. Making `db.ts` verify the pragma return values at boot is a small change and would make this rule true; it is not done.
* The Linux mount check cannot be simulated from a test on Windows. It is exercised only by reading `/proc/mounts` on a Linux host (Docker).
* A mapped network drive letter (`Z:\`) on Windows is not detected; only UNC paths are.

---

## 3. Proof It Can Fail

Mutation proof, measured 2026-10-01 with `pnpm robots:sabotage`:

| Mutation | Result |
|---|---|
| UNC check removed | caught: 1 test failed |
| `busy_timeout` set to 0 | caught: 1 test failed |
