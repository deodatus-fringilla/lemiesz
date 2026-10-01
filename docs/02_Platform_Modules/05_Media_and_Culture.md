# Module 05 · Media & Cultural Engine (Phase 6)

> **Doc type: SPECIFICATION (implemented 2026-10-01).**
> Owns the design of the media library. The schema itself lives in [005_media.sql](../../src/lib/server/migrations/005_media.sql) and is not copied here (Canon 03 D2: one fact, one home). Live status: [Harness Ledger](../10_Harness/02_Harness_Ledger.md). The consultation that produced this design: [the architect exchange letter](../00_Architect_Exchange/2026-10-01_Letter_Antigravity_to_Architect_Phase_6_and_Robots.md).

---

## 1. Purpose

> *"Politics is downstream from culture."*

The platform equips debaters with verified texts. Public sentiment also moves through music, anthems, speeches and clips. Phase 6 adds a library of such items that people can **search, play, and attach to argument cards**, and that the Content Engine can **suggest** in drafts, under the same trust rule as everything else: nothing reaches public output unless a human approved it.

Media are **not sources**. A source is canonical text the movement quotes; a media asset is a link plus metadata. They live in their own table (`media_assets`) so source queries, the trust filter and the citation guards are untouched.

---

## 2. Design decisions (architect consensus, 2026-10-01)

| Decision | Rule |
|---|---|
| Storage | Separate `media_assets` table, `fts_media` FTS5 index kept in sync by insert/update/delete triggers, `argument_media_links` join table. |
| Hosting | **External embeds only in v1** (YouTube via `youtube-nocookie.com`, Spotify). No local audio hosting. Cover images are not stored: `img-src` is `self`, and loading third-party images would leak visitor IPs. |
| CSP | Production `frame-src` is exactly `https://www.youtube-nocookie.com https://open.spotify.com`, and equals `EMBED_HOSTS` in `src/lib/server/media.ts` ([ROBOT-09](../17_Robots/ROBOT-09-media-link-privacy-gate.md) compares them). |
| Embed URLs | **Derived by code** from the pasted link (`parseMediaUrl`), never accepted from input; a database CHECK refuses any other host. Playlist, list and tracking parameters are dropped from the canonical URL. |
| Trust | New assets and seeds are `draft`. Only a signed-in human sets `human_approved`; the system actor cannot. Editing anything the public sees (title, artist, link, genre, credits, lyrics, licence) resets an approved asset to `draft`. Internal notes do not. |
| Credit | `ai_assisted = 1` requires non-empty `production_credits` (code and CHECK). |
| Lyrics | Stored only with an explicit `lyrics_cleared_to_store = 1` **and** licence terms of at least 5 characters (code and CHECK), mirroring [ROBOT-07](../17_Robots/ROBOT-07-license-and-storage-gate.md) for text sources. The seed stores none. |
| Content Engine | The model may refer to media **only** as `[[media:ID]]`, validated against the approved set offered in that run. The system expands the token from database fields (title, artist, link, and a human-written cue). A model never types a title, URL or timestamp; an unknown or unapproved id is stripped. |
| Cues | Written by a human on the `argument_media_links` row, format `m:ss` or `m:ss - m:ss`. |

---

## 3. Capabilities

### A. Media library (`/media`)
* Genre pills (one per `genre` value, labels are i18n messages), full-text search over title, artist and stored lyrics (diacritics ignored), approved items listed first.
* Detail pane: no-cookie player, link to the platform (an uploader can disable embedding; one seed already has), credits, lyrics when cleared, linked argument cards with cues, approve/flag/back-to-draft, edit, delete (creator or admin).
* Any signed-in member can add and approve, like the rest of the review workflow. Tightening that (for example, approval by admins only) is a policy decision for the architect.

### B. Content Engine (`/content`)
* `mediaForContent(platform, retrievedArgumentIds)` offers at most three items: approved items linked to the retrieved cards first (with their cue), then approved items whose `genre` suits the platform (`PLATFORM_GENRES`: press → sacred/classical; shorts → synth/reggae/rock-metal; facebook → patriotic-folk/classical/sacred; x → synth/patriotic-folk/rock-metal/reggae). Drafts and flagged items are never offered.
* Expansion: for **shorts** `Title — Artist, <cue>`; for other platforms `Title — Artist: <link>`. The expanded text counts toward the platform checks (for example the 280-character limit), and its digits are treated as supported by the unsupported-numbers check.
* Each draft stores the ids of the media it used (`content_drafts.media_json`).
* Prompt version `content-v2`.

### C. Not built (and why)
* **Live link checking** (HTTP 200): needs the network; a candidate for an on-demand script, not part of `pnpm robots`.
* **Search integration in the Shield** ("cultural counter-link" beside canonical sources): changes what a Shield answer cites and needs its own design. The Shield's citation guard is untouched.
* **Local audio streaming**, Rumble, Odysee: no CSP entry, no player.

---

## 4. Seed (2026-10-01)

Replaces the scratch file `docs/temp_links.txt`. Both rows are `draft` and carry what was verified and what was not.

| Row | Verified | Not verified / issue |
|---|---|---|
| *Iluzja Wolności* | Title and channel ("Attemis - Topic") match the video `URYM2FITucQ`; the embed plays. | The AI-assistance credit (Suno AI, DistroKid) and the release date come from the owner. |
| *Rota (Power Metal arrangement)* | Video `mvCZ5zhCt5Q` is titled "Rota \| Epicki Polski Hymn \| Power Metal Polish Patriotic Oath". | It is a power-metal arrangement, not a traditional folk performance, so its genre is `rock_metal`, not `patriotic_folk` as the earlier draft assumed. The uploader is unknown. **Embedding is disabled by the uploader** ("Playback on other websites has been disabled", seen in the app on 2026-10-01): the player cannot work, the link opens YouTube. |

---

## 5. Guarding robots
* [ROBOT-09](../17_Robots/ROBOT-09-media-link-privacy-gate.md): only privacy-respecting embed hosts, CSP and code in agreement.
* [ROBOT-10](../17_Robots/ROBOT-10-lyrics-attribution-gate.md): transparent AI credit, lyrics only when cleared, only a human approves, an edit withdraws approval. (An earlier draft said it "confirms lyrics match the audio": no robot can, so it does not claim to.)
