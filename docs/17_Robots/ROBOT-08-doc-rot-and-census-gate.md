# ROBOT 08 — The Fleet Census & Doc-Rot Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: OPEN FOR DISCUSSION & CONSULTATION.**
> Fleet Index: [README](README.md) · Live Status: [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md)

| Attribute | Specification |
|---|---|
| **Number** | 08 |
| **Tier** | Static Gate · Plain Node |
| **Source** | `scripts/robots/census-gate.mjs` |
| **Guards** | Documentation rot, phantom robot files, broken cross-links |
| **Proves it can fail** | `--self-test` flags synthetic unindexed robot file |

---

## 1. Why This Exists

Documentation rot is the natural state of long-lived software projects. A developer or AI agent creates a new robot file `ROBOT-09.md`, forgets to register it in `README.md`, forgets to add a status row in `10_Harness/02_Harness_Ledger.md`, or lets cross-links rot when files move.
Before long, no one knows which tests are active, which are planned, or which are broken.

ROBOT-08 is the meta-guardian of the robot fleet: **the robot that audits the robots.**

---

## 2. Invariant Rules

1. **The Three Homes Enforcement:**
   - For every `docs/17_Robots/ROBOT-*.md` file:
     - It MUST have an entry in the table in `docs/17_Robots/README.md`.
     - It MUST have a status row in `docs/10_Harness/02_Harness_Ledger.md`.
     - Its declared source file (`Source: ...`) MUST physically exist on disk.
2. **Numbering Integrity:** No duplicate robot numbers permitted (preventing collisions like Lilibog's `36a/36b`).
3. **Broken Link Detection:** All relative markdown links within `docs/` must resolve to existing files and valid anchors.
4. **Machine-Local Path Prohibition:** No absolute paths (like `C:\Users\...` or `file:///C:/...`) allowed in durable markdown documentation.

---

## 3. Proof It Can Fail

- **Self-Test Mode (`node scripts/robots/census-gate.mjs --self-test`):**
  Passes a mock directory containing an orphaned robot file not listed in the index.
- **Assertion:** The gate exits with code 1 and outputs an error identifying the orphaned document.
