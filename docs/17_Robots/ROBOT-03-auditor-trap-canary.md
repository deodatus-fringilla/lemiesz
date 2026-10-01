# ROBOT 03 — The Auditor Trap (Canary Gate)

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: PARTLY IMPLEMENTED (2026-10-01).** The offline half runs in `pnpm robots`; the half that needs a real auditor model has never been run. Live status lives in the [Harness Ledger](../10_Harness/02_Harness_Ledger.md).
> Fleet Index: [README](README.md)

| Attribute | Specification |
|---|---|
| **Number** | 03 |
| **Tier** | Eval (offline half: Vitest; model half: `pnpm eval`) |
| **Guarded code** | `src/lib/server/pipeline/auditor.ts`, `src/lib/server/eval/harness.ts` (`evaluateAuditor`) |
| **Executable** | `tests/robots/robot-03-auditor-trap.robot.ts` (offline) and `src/lib/server/eval/quality.eval.ts` (real auditor; needs the LLM_AUDITOR_ variables) |
| **Data** | `eval/bad-cards.json` is the single source of truth for the traps |
| **Guards** | Independent auditor vigilance: an auditor that approves everything creates false confidence |
| **Proves it can fail** | A rubber-stamp and a paranoid fake auditor are both exposed, see §3 |

---

## 1. Why This Exists

An AI Auditor that approves everything is dangerous. When its model or prompt changes, its sensitivity to fabricated quotes, misattribution and doctrinal drift can degrade silently. ROBOT-03 keeps a permanent battery of cards with known defects, written by humans, and measures what the auditor does with them. Until it has run against a real auditor, `ai_verified` is only a hint, which is why the Content Engine refuses it by default (ROBOT-02).

---

## 2. The Battery (`eval/bad-cards.json`)

| Card id | Kind | Defect | Caught by |
|---|---|---|---|
| `bad-fabricated-quote` | `fabricated_quote` | A sentence that does not occur in the cited Hague article | code: span check (ROBOT-01), no LLM needed |
| `bad-misattributed-source` | `misattributed` | A real Gaudium et Spes sentence attributed to a Hague article | code: span check, no LLM needed |
| `bad-off-doctrine` | `off_doctrine` | A real inviolability quote used to argue for joining a military alliance with foreign troops, against the neutrality tenet | the LLM auditor only |
| `bad-overreach` | `overreach` | A real Pacem in Terris quote stretched into "no state may ever defend itself" | the LLM auditor only |
| `control-sound-1`, `control-sound-2` | `control` | Sound cards that must be verified | (negative control) |

The earlier draft of this spec listed five different traps (A–E: out-of-context attribution, non sequitur, doctrinal inversion, number tampering). Those are **candidates**, not yet written; add each as a card in `eval/bad-cards.json` with real spans, and this table, together. Seed ideas unique to this movement: pacifism versus self-defence (a card that equates the movement with absolute pacifism), and sovereignty versus alliance obligations. Humans write the cards; a model must not.

---

## 3. Invariant Rules and Proof

1. **Independence.** Drafter and Auditor must be from different model families; `assertIndependent` in `src/lib/server/llm` refuses otherwise (covered by `llm.test.ts`).
2. **Offline half (every `pnpm robots`).**
   - The battery is well formed: unique ids, every trap class present, at least two controls, every card has spans.
   - **Rubber-stamp auditor** (a fake that approves everything): the deterministic traps are still caught by code (rate 1), the model-dependent traps get through (rate 0). This is the proof the canary can fail.
   - **Paranoid auditor** (rejects everything): catches every trap but verifies no control (control pass rate 0).
3. **Model half (`pnpm eval`, only when `LLM_AUDITOR_BASE_URL`, `_API_KEY`, `_MODEL` are set).** `quality.eval.ts` requires `deterministicCatchRate`, `llmCatchRate` and `controlPassRate` to be 1. **Not yet measured: no real LLM has been called.** The first real run may legitimately show that the 100% criterion is too strict for the controls; decide from the evidence, then change this spec and the assertion together.

Measured 2026-10-01 (`pnpm robots`): offline half passes. Model half: not run.
