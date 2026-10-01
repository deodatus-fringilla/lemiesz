# ROBOT 09 — The Media Link & Privacy Embed Gate

> **Doc type: DURABLE RULING + MEASURED FACTS.**
> **STATUS: IMPLEMENTED, offline half (2026-10-01).** The live link check needs the network and is not written. Live status lives in the [Harness Ledger](../10_Harness/02_Harness_Ledger.md).
> Fleet Index: [README](README.md)

| Attribute | Specification |
|---|---|
| **Number** | 09 |
| **Tier** | Backend (Vitest, offline) |
| **Guarded code** | `src/lib/server/media.ts` (`parseMediaUrl`, `isAllowedEmbed`, `EMBED_HOSTS`), the `embed_url` CHECK in `src/lib/server/migrations/005_media.sql`, the `frame-src` directive in `vite.config.ts`, the `<iframe>` in `src/routes/media/+page.svelte` |
| **Executable** | `tests/robots/robot-09-media-embed.robot.ts` |
| **Run** | `pnpm robots` · sabotage proof: `pnpm robots:sabotage` |
| **Guards** | Visitor privacy (no third-party cookie or IP leak through embeds), CSP and code agreeing |
| **Proves it can fail** | Mutation proof (4 mutations) and look-alike-host fixtures, see §3 |

---

## 1. Why This Exists

Embedding a YouTube or Spotify player lets that company set cookies and see the visitor's IP. YouTube's `youtube-nocookie.com` host avoids the cookies, and the app's Content-Security-Policy must permit exactly the hosts it uses, no more. Links pasted by people are untrusted input: a look-alike domain or a non-http scheme must never reach an `<iframe>`.

---

## 2. Invariant Rules

1. **Only two embed hosts:** `www.youtube-nocookie.com` and `open.spotify.com`, https, path `/embed/…`. `isAllowedEmbed` encodes it; the cookie-setting `www.youtube.com/embed` is refused.
2. **Derived, not accepted.** The embed URL is computed from the parsed platform and id; look-alikes (`youtube.com.evil.example`), other hosts and schemes make `parseMediaUrl` return null. Tracking parameters (`list`, `si`, `utm_*`) are dropped from the stored URL.
3. **Second lock:** the database CHECK rejects any other `embed_url`.
4. **CSP equals code:** the production `frame-src` hosts are exactly `EMBED_HOSTS`. The smoke test also checks the header on the built server.
5. **One iframe, one source:** every `<iframe>` in the app takes its `src` from a record's `embed_url`.
6. **Seeds are canonical:** every seed link parses to itself.

### Not covered
* **Link liveness (HTTP 200) and uploader-disabled embedding.** Needs the network. Observed 2026-10-01: the *Rota* seed's embedding is disabled by the uploader, which no offline check can see. A future on-demand script (`oEmbed` request per approved asset) could; it is not part of `pnpm robots`.

---

## 3. Proof It Can Fail

Mutation proof, measured 2026-10-01 with `pnpm robots:sabotage`:

| Mutation | Result |
|---|---|
| YouTube embeds use `www.youtube.com` instead of the no-cookie host | caught: 2 tests failed |
| The code allows a host the CSP does not | caught: 2 tests failed |
| The CSP allows a third-party frame host | caught: 1 test failed |
| The database CHECK accepts any host | caught: 1 test failed |
