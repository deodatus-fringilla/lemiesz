# Canon 03 · Rules of Engagement & Engineering Discipline

> **Doc type: DURABLE RULING.**
> **STATUS: OPEN FOR DISCUSSION & CONSULTATION.**
> Defines the operational laws for developers, human reviewers, and AI coding agents working on Pakt Lemiesza (`lemiesz`).

---

## D1 · Conclusions Rot; Robots Don't
Prose rules written in design documents, summaries, or commit messages rot within 2–3 sessions. Human and AI memory fades; context windows get truncated.
- **The Rule:** Any principle that cannot be violated without breaking the project's integrity must have an automated test or gate attached to it.
- **The Name:** We call these automated gates **Robots** (see [17_Robots](../17_Robots/README.md)).

---

## D2 · One Fact, One Home
Every fact, status, or design decision has exactly one authoritative owner file.
- If a status is tracked in [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md), do not restate the status in an architecture document. Link to it.
- If a quote exists in the database, never duplicate the text into an AI prompt or hand-written doc. Reference its ID.
- If two documents disagree, the designated authority wins and the other document is a defect.

---

## D3 · The Three Homes of Every Robot
A robot cannot be declared to exist simply because a test was run in a terminal. Every robot must have **three homes**:
1. **Its specification document:** `docs/17_Robots/ROBOT-XX-name.md` explaining *why it exists, what it guards, and how it proves it can fail*.
2. **Its status entry in the ledger:** `docs/10_Harness/02_Harness_Ledger.md` stating its current live pass/fail status and the date it was measured.
3. **Its executable implementation:** A script in `scripts/robots/` or a suite in `tests/robots/`.

---

## D4 · Proof of Failure (The Sabotage Rule)
*A test you have never seen fail is a test you cannot trust.*
- Every robot must demonstrate how it proves it can fail:
  - **Negative Controls:** Providing deliberately poisoned inputs (e.g. invalid citation ID, fabricated quote, unauthorized role) and verifying failure.
  - **Sabotage Proof:** Temporarily corrupting the application code to confirm the robot turns RED before accepting it as GREEN.
  - **Self-Test Mode (`--self-test`):** For static gates, passing a synthetic failing payload on each execution to verify the gate catches it before checking real files.

---

## D5 · Truth in Citations (Zero Hallucination)
Pakt Lemiesza is an ideological repository and rhetorical shield. Credibility is existential.
- No LLM may invent, embellish, or paraphrase a quotation inside quotation marks.
- Quotation tokens (`[[src:ID]]`) in streaming output must be resolved to database-stored, human-verified text only.
- Any output that fails the verbatim substring check must be intercepted or visually flagged before public exposure.
