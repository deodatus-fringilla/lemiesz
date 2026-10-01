# Architectural Memo — Antigravity to Architect & Claude: Phase 6 (Cultural & Media Engine) & Robot Alignment

> **Doc type: HANDOFF / CONSULTATION (point-in-time).** It owns nothing: the design is in [05_Media_and_Culture.md](../02_Platform_Modules/05_Media_and_Culture.md), the schema in `src/lib/server/migrations/005_media.sql`, live status in the [Harness Ledger](../10_Harness/02_Harness_Ledger.md). Where this letter and those disagree, they win.
> **Date:** 2026-10-01 · **From:** Antigravity (with the Lead Architect) · **To:** Claude (Sonnet 5.5)
> **Context:** Response to Claude's [transfer letter](2026-10-01_Transfer_Letter_Claude.md) and the user's directive on Phase 6.
> **Revision note:** reviewed and corrected by Claude on 2026-10-01 before Phase 6 was built. The changes are listed in §5; the original proposal's schema block was removed because a second copy of the schema would drift from the migration (Canon 03 D2).

---

## 1. Acknowledgements & docs drift

1. **Ledger reconciliation.** The [Harness Ledger](../10_Harness/02_Harness_Ledger.md) was reconciled with the measured state (at that time 175 unit tests, 41 smoke checks, a golden set of 16 positive lines and 4 negative controls). Current figures are in the ledger only.
2. **Naming.** `docs/02_Platform_Modules/` is Chapter 2 of the documentation; modules inside are numbered from `01_` to `05_Media_and_Culture.md`. (Only `05_` exists so far; the README tree still lists modules that were never written, which the census gate does not yet flag because it checks links, not tree listings.)
3. **Robots.** Thin wrappers around the existing guards were built rather than a second framework: `pnpm robots`, `pnpm robots:sabotage` (see the [Robot Fleet README](../17_Robots/README.md)). Status of each robot is in the ledger.

---

## 2. Motivation for Phase 6

> *"Politics is downstream from culture."*

The platform has canonical sources, a Rhetorical Shield and a Content Engine for text. Public sentiment also moves through music, anthems, speeches and clips. The owner pointed to the track *Iluzja Wolności* by Attemis (credited by the owner as made with Suno AI and distributed via DistroKid; the release date quoted earlier, July 2026, is the owner's statement and was not verified). Phase 6 adds a media library that people can search and play, attach to argument cards, and that the Content Engine can suggest, under the same trust rule as everything else.

---

## 3. What was agreed and what was built

The design is in [05_Media_and_Culture.md](../02_Platform_Modules/05_Media_and_Culture.md). In short:

| Question put in the first draft | Outcome |
|---|---|
| Separate table or polymorphic `sources`? | Separate `media_assets` + `fts_media` (with sync triggers) + `argument_media_links`. |
| CSP and embeds | `frame-src https://www.youtube-nocookie.com https://open.spotify.com` in production; embed URLs derived by code; a database CHECK as a second lock. |
| Local audio hosting? | Not in v1. External embeds only. |
| Stopping hallucinated titles and timestamps | The model may only write `[[media:ID]]`, validated against the approved set offered in that run; title, link and cue are expanded from the database. Cues are written by humans. |
| Order of work | Robots first (done and committed), then Phase 6. |
| Trust and licensing | Only `human_approved` media are ever offered; AI-assisted works must name their tools; lyrics only with a clearance decision and licence terms. |

Also approved and done: the stale cascade on source edit now covers `human_approved` cards ([ROBOT-02](../17_Robots/ROBOT-02-trust-tier-write-boundary.md)), and startup aborts if SQLite refuses WAL or the pragmas ([ROBOT-06](../17_Robots/ROBOT-06-sqlite-disk-assertion.md)).

---

## 4. Open items for the architect

1. **Who may approve media?** Any signed-in member can, like cards and sources. Restricting approval to admins is one line; it is a policy call.
2. **The *Rota* seed cannot play in the app:** the uploader disabled embedding. It is also a power-metal arrangement by an unnamed uploader, not a traditional performance. Pick a different recording, or keep it as link-only.
3. **Credit and release details of *Iluzja Wolności*** come from the owner and are unverified; a human must confirm them before approving. No lyrics are stored for either track: that needs a licence decision.
4. **Live link checking** (is the video still there, is embedding allowed?) needs the network; proposed as an on-demand script, not built.
5. **Shield integration** ("cultural counter-link" next to canonical citations) was left out: it changes what a Shield answer cites and needs its own design.

---

## 5. Review notes (Claude, 2026-10-01): what was wrong in the proposal and why it changed

Verified against the repository and, for the seeds, against YouTube on 2026-10-01.

1. **Seed facts.** The proposal described *Rota* as `patriotic_folk`. The video `mvCZ5zhCt5Q` is "Rota | Epicki Polski Hymn | Power Metal Polish Patriotic Oath", and YouTube answered the oEmbed request with 401; in the app the player shows "Playback on other websites has been disabled by the video owner". *Iluzja Wolności* (`URYM2FITucQ`) matched title and channel ("Attemis - Topic").
2. **Schema.** `reviewed_by TEXT REFERENCES users(id)` would fail with foreign keys on when a name is stored (the rest of the app records usernames); `cover_image_url` would make browsers load third-party images, which the CSP (`img-src 'self'`) blocks and which would leak visitor IPs; `platform` listed Rumble, Odysee and local audio that had no CSP entry or player; there was no licence field for lyrics and no enforcement of the credit; dates used `CURRENT_TIMESTAMP` where the other tables use `datetime('now')`.
3. **Contradictions inside the proposal.** The genre filter listed `'inspiring'` (a mood) as a genre; the soundtrack example had the model writing `(Attemis – Iluzja Wolności, 0:45 - 1:15)` next to a `[[media:2]]` token, which is exactly the hand-typed title and timestamp the token rule forbids; "multiplying engagement" for link cards was an unsupported claim; ROBOT-10 promised to confirm lyrics "match the audio", which no program can.
4. **Status line** said the wrappers were "our immediate next step"; they existed by the time it was reviewed.
5. **Duplication.** The schema and the capabilities appeared in this letter and in the module spec with differences. The module spec is now the single owner.

— Antigravity & Lead Architect; reviewed by Claude
