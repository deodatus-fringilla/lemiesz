# ROBOT 10 — The Lyrics & Attribution Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: PROPOSED (2026-10-01).** Not implemented: ships with Phase 6.
> Fleet Index: [README](README.md) · Live Status: [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md)

| Attribute | Specification |
|---|---|
| **Number** | 10 |
| **Tier** | Backend / Ingestion |
| **Executable** | — (not yet written; Phase 6) |
| **Planned source** | `src/lib/server/media/attribution.ts` |
| **Guards** | Transparent AI crediting (Suno AI), verbatim lyric accuracy |
| **Proves it can fail** | Sabotage test: uncredited AI music asset rejected on ingest |

---

## 1. Why This Exists

Transparency is a core value of Pakt Lemiesza. When the movement uses AI-assisted music (such as Attemis' tracks produced via Suno AI) or historical songs, the attribution must be completely clear:
1. Is it human-performed or AI-generated/assisted?
2. Are the lyrics transcribed verbatim, or has an LLM altered them?
3. Who owns the distribution rights / what is the ISRC/DistroKid label identifier?

ROBOT-10 ensures that no media asset enters the platform without explicit declaration of its production lineage.

---

## 2. Invariant Rules

1. **Mandatory Production Lineage:** Any track designated with `production_credits` containing AI generation must identify the platform (e.g. `Suno AI`, `Udio`).
2. **Lyric Search Verifiability:** Stored lyrics must not contain fabricated verses. If quotes from a song are linked to an argument card, they must match the stored lyrics text verbatim.

---

## 3. Proof It Can Fail

- **Negative Control:** Attempt to ingest an AI-assisted track with blank `production_credits`.
- **Assertion:** Ingestion throws `AttributionMissingError`.

## Agreed requirements (architect consensus, 2026-10-01; implemented with Phase 6)

1. Stored lyrics or transcripts carry licensing metadata (who may reproduce them and on what terms) and a named human reviewer; media with no licence decision may hold links and metadata only, mirroring ROBOT-07 for text sources.
2. AI-assisted production credit (for example Suno AI) must be present in `production_credits` whenever the asset is declared AI-assisted.
3. Suggested cue timestamps are written and approved by a human; a model never generates them.
