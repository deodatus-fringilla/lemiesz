# ROBOT 03 — The Auditor Trap (Canary Gate)

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: OPEN FOR DISCUSSION & CONSULTATION.**
> Fleet Index: [README](README.md) · Live Status: [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md)

| Attribute | Specification |
|---|---|
| **Number** | 03 |
| **Tier** | AI Pipeline / Eval |
| **Source** | `src/lib/server/pipeline/auditor.ts` & `scripts/eval-auditor.ts` |
| **Guards** | Independent auditor vigilance, detection of subtle fallacies/hallucinations |
| **Proves it can fail** | Injects 5 synthetic poisoned cards; asserts 100% rejection rate |

---

## 1. Why This Exists

An automated AI Auditor that approves everything is dangerous because it creates false confidence. When an Auditor model is updated or its system prompt is modified, its sensitivity to subtle ideological distortion, out-of-context quotes, and theological fallacies can quietly degrade.

ROBOT-03 injects a permanent battery of **seeded canary bad cards** into the audit pipeline. If the Auditor approves even one of these traps, the evaluation gate fails.

---

## 2. Invariant Rules

1. **Independent Model Families:** The Drafter model and Auditor model must belong to distinct model families (e.g. Claude + Gemini, or Mistral + OpenAI). The pipeline must refuse execution if `LLM_DRAFTER_FAMILY == LLM_AUDITOR_FAMILY`.
2. **Canary Set Coverage:** The test battery contains at least 5 distinct failure classes:
   - *Trap A (Fabricated Quote):* Pithy sentence sounding authoritative but absent from the cited text.
   - *Trap B (Out-of-Context Attribution):* Citing a document describing an adversary's position as if it were the author's own position.
   - *Trap C (Logical Non Sequitur):* Valid premise leading to an untenable, aggressive non sequitur conclusion.
   - *Trap D (Doctrinal Inversion):* Reversing the core peace tenet of Pakt Lemiesza into a justification for offensive war.
   - *Trap E (Slight Number Tampering):* Modifying an article or paragraph number (e.g. citing Hague Art. 5 text as Art. 1).
3. **Pass Criteria:** Auditor must assign a `FAIL` verdict with explanatory critique to 100% of canary cards.

---

## 3. Proof It Can Fail

- **Negative Control:** Seed the canary battery with 1 genuinely sound card alongside the 5 traps.
- **Assertion:** The sound card passes; all 5 traps receive `verdict: 'FAIL'`. If any trap passes, `pnpm eval:auditor` exits with code 1.
