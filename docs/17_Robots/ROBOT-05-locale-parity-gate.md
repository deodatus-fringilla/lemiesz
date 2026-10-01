# ROBOT 05 — The Locale Parity Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: OPEN FOR DISCUSSION & CONSULTATION.**
> Fleet Index: [README](README.md) · Live Status: [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md)

| Attribute | Specification |
|---|---|
| **Number** | 05 |
| **Tier** | Static Gate · Plain Node |
| **Source** | `scripts/robots/locale-parity.mjs` |
| **Guards** | 1:1 translation key parity across Polish and English dictionaries |
| **Proves it can fail** | `--self-test` flags synthetic missing key in fixture |

---

## 1. Why This Exists

Pakt Lemiesza is bilingual by design (Polish for domestic debate, English for international outreach and legal treaties). When features are added to UI pages (such as `/shield` or the upcoming `/engine`), developers frequently add string keys to `messages/pl.json` but forget `messages/en.json`, or vice-versa.
In Svelte / Paraglide, a missing translation key results in either a runtime crash or raw ugly fallback keys like `shield_disclaimer_missing` shown to the user.

ROBOT-05 is a zero-overhead static script that inspects all locale dictionaries on pre-commit and CI, failing the build if key parity is broken.

---

## 2. Invariant Rules

1. **Bidirectional Symmetry:** Every key path in `messages/pl.json` must exist in `messages/en.json`, and every key path in `messages/en.json` must exist in `messages/pl.json`.
2. **Type/Shape Parity:** If a key maps to an object (nested namespace) in one language, it must map to an object in the other. If it maps to a string with replacement parameters (e.g. `{count}`), the parameters in both languages must match.
3. **Empty String Detection:** Translation strings cannot be blank or contain placeholder markers like `TODO` or `FIXME`.

---

## 3. Proof It Can Fail

- **Self-Test Mode (`node scripts/robots/locale-parity.mjs --self-test`):**
  Passes a mock dictionary pair where `en` has key `btn_cancel` missing from `pl`.
- **Assertion:** The gate exits with code 1 and prints the exact missing key path.
