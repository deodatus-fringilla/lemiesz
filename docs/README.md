# Documentation Sitemap & Knowledge Architecture

> **STATUS: DRAFT FOR DISCUSSION & REFINEMENT**
> This directory structure is designed to preserve architectural truth, prevent documentation rot across multi-agent sessions, and scale cleanly as Pakt Lemiesza grows.

---

## 🏛️ Directory Structure

```
docs/
├── README.md                         # This file: navigation, conventions, and rules
├── 00_Canon/                         # Chapter 0: Inviolable rulings, core doctrine, rules of engagement
│   ├── 01_Ideological_Doctrine.md    # The three tenets, theological/legal foundations, quote truth
│   ├── 02_Architecture_Manifesto.md  # SQLite/WAL, Svelte 5 runes, multi-provider LLM, offline-first
│   └── 03_Rules_of_Engagement.md     # "One fact, one home", proof-of-failure rule, measurement rule
├── 01_Architecture/                  # Chapter 1: Living technical blueprints and schema specifications
│   ├── 01_System_Overview.md         # Component diagrams, trust tiers, data flows
│   ├── 02_Database_Schema.md         # SQLite tables, FTS5 virtual tables, migrations
│   ├── 03_RAG_and_Embeddings.md      # Hybrid search, vector calibration, local ONNX embeddings
│   └── 04_AI_Pipeline_and_Audit.md   # Drafter + Auditor protocol, canary testing, prompt contracts
├── 02_Platform_Modules/              # Chapter 2: Functional platform modules (living specs)
│   ├── 01_Repository_and_Sources.md  # Phase 1: Sources, licensing, ingestion checklist
│   ├── 02_Ideological_Shield.md      # Phase 3: Live debate defense, SSE streaming, citation engine
│   ├── 03_Content_Engine.md          # Phase 4: Multi-platform generators (X, FB, Shorts, Press)
│   ├── 04_Review_Queue.md            # Phase 2/5: Human approval, stale cascades, audit logs
│   └── 05_Media_and_Culture.md       # Phase 6: Songs, videos, cultural assets, lyrics FTS5
├── 10_Harness/                       # Test strategy, benchmarks, and live status ledger
│   ├── 01_Testing_Strategy.md        # 4 testing tiers, local execution instructions
│   └── 02_Harness_Ledger.md          # Live pass/fail tracker (measured facts with dates)
├── 17_Robots/                        # The Automated Robot Fleet (guards against drift)
│   ├── README.md                     # Fleet census, numbering rules, tier breakdown
│   ├── ROBOT-01-verbatim-quotation-gate.md
│   ├── ROBOT-02-trust-tier-write-boundary.md
│   ├── ROBOT-03-auditor-trap-canary.md
│   ├── ROBOT-04-golden-set-retrieval.md
│   ├── ROBOT-05-locale-parity-gate.md
│   ├── ROBOT-06-sqlite-disk-assertion.md
│   ├── ROBOT-07-license-and-storage-gate.md
│   └── ROBOT-08-doc-rot-and-census-gate.md
├── discussions/                      # Consultation logs and debate critiques
│   └── implementation_plan_critique.md
├── implementation_plan.md            # Authoritative implementation plan (v2)
└── implementation_plan.v1.md         # Archived v1 plan
```

---

## 📜 Core Conventions (Adopted from the Lilibog Model)

1. **One Fact, One Home:**
   Every fact, rule, or status has exactly one authoritative owner. If a number or ruling is duplicated, it will inevitably rot. All other places must link to the owner rather than paraphrasing.

2. **Conclusions Rot; Robots Don't:**
   Any critical architectural or editorial rule written only in prose will be forgotten or violated by future sessions. If a rule matters, it must be guarded by a numbered automated **Robot**.

3. **Proof of Failure Discipline:**
   A test or robot you have never seen fail is a test you cannot trust. Every robot must carry proof that it can fail (via negative controls, deliberate code sabotage, or `--self-test`).

4. **Measured Claims Carry Dates:**
   Never state "all tests pass" or "recall is 100%" without recording the date and the command used to take that measurement.
