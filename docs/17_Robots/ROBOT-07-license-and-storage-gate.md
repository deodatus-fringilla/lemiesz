# ROBOT 07 — The License & Cleared-to-Store Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: OPEN FOR DISCUSSION & CONSULTATION.**
> Fleet Index: [README](README.md) · Live Status: [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md)

| Attribute | Specification |
|---|---|
| **Number** | 07 |
| **Tier** | Backend / Ingestion |
| **Source** | `src/lib/server/sources.ts` & `src/lib/server/checklist.ts` |
| **Guards** | Copyright compliance, attribution discipline, safe text storage |
| **Proves it can fail** | Negative control: unreviewed copyrighted text ingestion rejected |

---

## 1. Why This Exists

Storing full texts of modern copyright-protected books, articles, or translations without explicit permission is an intellectual property liability. For public domain texts (e.g. 1907 Hague Convention) or open Vatican encyclicals, full text storage is permissible; for commercial commentary, only short fair-use quotations or link references with `cleared_to_store = 0` are permitted.

ROBOT-07 acts as a legal firewall during source creation, updates, and database seeding: no text may be saved with `cleared_to_store = 1` unless licensing and review criteria are formally satisfied.

---

## 2. Invariant Rules

1. **Storage Clearance Boundary:** If `cleared_to_store == 0`, attempting to write text into `content` throws an error or requires truncation to snippet length.
2. **Reviewer Attribution Required:** Any source marked `cleared_to_store == 1` must specify `license_type` (e.g. `public_domain`, `vatican_open`, `cc_by_sa`, `fair_use_quote`) and a non-empty `reviewed_by` identifier.
3. **URL Verifiability:** All seeded sources must include a live canonical URL. Automated seed verification scripts periodically re-fetch the official source to confirm the passage has not been retracted or corrupted.

---

## 3. Proof It Can Fail

- **Negative Control:** Attempt to insert a new source text having `cleared_to_store = 1` and `license_type = ''` or `reviewed_by = null`.
- **Assertion:** Database schema constraint or repository insertion method rejects the operation with `LicenseMissingError`.
