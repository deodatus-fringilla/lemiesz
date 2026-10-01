# ROBOT 05 — The Locale Parity Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: IMPLEMENTED (2026-10-01).** Live pass/fail lives in the [Harness Ledger](../10_Harness/02_Harness_Ledger.md).
> Fleet Index: [README](README.md)

| Attribute | Specification |
|---|---|
| **Number** | 05 |
| **Tier** | Static Gate · plain Node, no dependencies |
| **Guarded code** | `messages/*.json` |
| **Executable** | `scripts/robots/locale-parity.mjs` |
| **Run** | `pnpm robots` · alone: `node scripts/robots/locale-parity.mjs` · proof: `node scripts/robots/locale-parity.mjs --self-test` |
| **Guards** | 1:1 translation key parity across the UI locales |
| **Proves it can fail** | `--self-test` feeds six deliberately broken dictionary pairs, see §3 |

---

## 1. Why This Exists

The app is bilingual by design. When a page gains strings in `messages/pl.json` and not in `messages/en.json` (or the reverse), Paraglide shows raw keys or crashes. The existing `src/lib/i18n/locales.test.ts` also checks key parity against the locale registry inside `pnpm test`; this robot is the standalone, sub-second version that also checks content, and it needs neither Vite nor a database.

---

## 2. Invariant Rules

Base locale is `pl`; every other file in `messages/` is compared with it.

1. **Bidirectional key parity:** no missing key, no extra key (nested objects are flattened to dotted paths; `$`-prefixed metadata such as `$schema` is ignored).
2. **Parameter parity:** `{name}` placeholders in a translation must be the same set as in `pl`.
3. **No empty strings** and no `TODO` / `FIXME` markers.

---

## 3. Proof It Can Fail

`--self-test` runs on every `pnpm robots` and must detect each of: missing key, extra key, parameter mismatch, empty string, TODO marker, nested-shape mismatch, and must accept a correct pair. If any sabotage case goes undetected the robot reports FAIL.

Measured 2026-10-01: PASS on the real files (2 locales, 270 keys each).
