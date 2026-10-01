# ROBOT 09 — The Media Link & Privacy Embed Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: PROPOSED (2026-10-01).** Not implemented: ships with Phase 6.
> Fleet Index: [README](README.md) · Live Status: [10_Harness/02_Harness_Ledger.md](../10_Harness/02_Harness_Ledger.md)

| Attribute | Specification |
|---|---|
| **Number** | 09 |
| **Tier** | Backend / Media Ingestion |
| **Executable** | — (not yet written; Phase 6) |
| **Planned source** | `src/lib/server/media/checks.ts` |
| **Guards** | Dead external media links, CSP tracking leaks, insecure third-party iframes |
| **Proves it can fail** | Negative control: rejected on 404 URL or tracking domain embed |

---

## 1. Why This Exists

If a user attaches an external music track or YouTube debate clip to a public campaign thread, that link must not be dead, broken, or geo-blocked. Furthermore, embedding external video players can leak user IPs and track visitors unless strictly isolated.

ROBOT-09 verifies during ingestion and periodic health sweeps that:
1. Every external video/audio URL returns HTTP 200 OK.
2. YouTube embeds strictly use `https://www.youtube-nocookie.com/embed/...`.
3. The platform's Content-Security-Policy (CSP) `frame-src` directive permits only authorized media domains (`youtube-nocookie.com`, `open.spotify.com`).

---

## 2. Invariant Rules

1. **Privacy-Safe Embed Enforcement:** No iframe src may point to `youtube.com/watch` or `youtube.com/embed`; it must transform automatically to `youtube-nocookie.com/embed`.
2. **Liveness Verification:** An automated link health check re-queries canonical URLs periodically. If a media link returns 404 or 410, it is flagged as `unreachable` and hidden from the Content Engine selector.

---

## 3. Proof It Can Fail

- **Negative Control:** Attempt to save a media asset with `embed_url = 'https://youtube.com/embed/123'`.
- **Assertion:** Validation throws `InsecureEmbedError: Must use youtube-nocookie.com`.

## Agreed requirements (architect consensus, 2026-10-01; implemented with Phase 6)

1. Embeds only from `youtube-nocookie.com` and `open.spotify.com`; the production CSP gains `frame-src https://www.youtube-nocookie.com https://open.spotify.com` in `vite.config.ts`, and this robot asserts the CSP and the stored `embed_url` hosts agree.
2. Only `human_approved` media can be offered to the Content Engine, and the model may reference media only through `[[media:ID]]` tokens validated against the approved set and expanded from database fields (title, artist, cue); it never writes a title or timestamp itself.
3. Link liveness (HTTP 200) needs the network, so it is an on-demand check, not part of the offline `pnpm robots`.
