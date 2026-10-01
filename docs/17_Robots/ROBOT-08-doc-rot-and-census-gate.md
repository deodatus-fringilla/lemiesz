# ROBOT 08 — The Fleet Census & Doc-Rot Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: IMPLEMENTED (2026-10-01).** Live pass/fail lives in the [Harness Ledger](../10_Harness/02_Harness_Ledger.md).
> Fleet Index: [README](README.md)

| Attribute | Specification |
|---|---|
| **Number** | 08 |
| **Tier** | Static Gate · plain Node, no dependencies |
| **Guarded code** | `docs/` (all documents) against the repository |
| **Executable** | `scripts/robots/census-gate.mjs` |
| **Run** | `pnpm robots` · alone: `node scripts/robots/census-gate.mjs` · proof: `node scripts/robots/census-gate.mjs --self-test` |
| **Guards** | Documentation rot, phantom robots, broken cross-links |
| **Proves it can fail** | `--self-test` audits eight deliberately broken mock trees, see §3 |

---

## 1. Why This Exists

Documentation rots: a robot file is created and never registered, a ledger row claims PASS with no date, a spec names a script that was never written, a link dies when a file moves. The previous version of this fleet described `scripts/eval-auditor.ts` and `pnpm eval:auditor`, which never existed. ROBOT-08 is the robot that audits the robots, so that cannot recur.

---

## 2. Invariant Rules

For every `docs/17_Robots/ROBOT-NN-*.md`:

1. **Three homes (Canon 03 D3).** It is linked from `docs/17_Robots/README.md`; it has a row in the Harness Ledger linking to the same file; its attribute table has an `Executable` row naming files that exist on disk. A robot whose ledger status is *Proposed* may have no executable; any other status may not.
2. **Honest status.** A ledger status is PASS, FAIL or Proposed. PASS requires a measured date `YYYY-MM-DD` (Canon 03 D2).
3. **Numbering.** No duplicate numbers; the README's "highest number currently claimed" matches the folder; no ledger row without a spec.

For every markdown file in `docs/`:

4. **Links resolve.** Relative links point at existing files and, for `#anchor` links, at existing headings (GitHub slug rules). Code blocks and inline code are ignored.
5. **No machine-local paths** (`C:\Users\…`, `C:\www\…`, `file:///C:/…`).
6. **Archives are exempt.** A document whose first lines say `Doc type: ARCHIVE` is history and is skipped (currently `implementation_plan.v1.md`).

Not covered: whether numbers quoted in prose (test counts) are current. Those belong only in the ledger (Canon 03 D2); a future rule could flag digits-plus-"tests" outside it.

---

## 3. Proof It Can Fail

`--self-test` builds mock trees and requires each defect to be reported, and a consistent tree to pass: orphaned robot (no README entry or ledger row), missing ledger row, executable missing on disk, PASS without a date, duplicate number, broken link, broken anchor, machine-local path.

Measured 2026-10-01: PASS on the real `docs/` tree.
