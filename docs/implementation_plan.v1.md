# Implementation Plan - Pakt Lemiesza (PL) Management Center & Internal Second Brain

A secure, lightweight internal web application for the core team of **Pakt Lemiesza (PL)** (*The Plowshare Pact*). The platform combines an **Ideological Repository**, an AI-powered **Rhetorical Shield** for debate defense, and a **Content Engine** for social media & press generation, backed by a zero-infra SQLite database and an in-memory TypeScript RAG vector search mechanism.

## Architectural Overview

```
+-----------------------------------------------------------------------------------+
|                            Svelte 5 Frontend (Runes)                              |
|  - $state / $derived / $effect reactive isolation                                 |
|  - High-Contrast Dashboard (Tailwind CSS, Dark/Light Mode, Glassmorphism)         |
|  - Live Source Tracking Pane & Reactive Streaming UI                              |
+-----------------------------------------------------------------------------------+
                                       |
                         SvelteKit Server Endpoints (+server.ts)
                                       |
+-----------------------------------------------------------------------------------+
|                        Server In-Memory RAG Engine (hooks.server.ts)              |
|  - Global VectorCache held in RAM upon server initialization                      |
|  - Cosine Similarity match (top 3-5 chunks injected into LLM context)             |
|  - Embedding vector calculation & cache synchronization                           |
+-----------------------------------------------------------------------------------+
                                       |
+-----------------------------------------------------------------------------------+
|                           SQLite Database (better-sqlite3)                        |
|  - `knowledge_chunks`: id, title, category, content, embedding BLOB, created_at   |
|  - `messages`: id, conversation_id, role, content, context_sources, created_at    |
+-----------------------------------------------------------------------------------+
```

---

## Technical Design & Key Components

### 1. Database & In-Memory RAG Engine (`src/lib/server/`)
- **SQLite Database (`lemiesz.db`)**: Native SQLite integration using `better-sqlite3`. Auto-runs schema migrations on startup.
- **Seeded Knowledge Base**: Pre-loaded with core ideological texts (*Pacem in Terris*, *Gaudium et Spes*, Bastiat's *The Law*, Swiss Neutrality Charter, PL Movement Manifesto, Double Distance Strategy).
- **In-Memory `VectorCache`**:
  - `hooks.server.ts` bootstraps all chunks from SQLite into a global server-side runtime array (`VectorCache`).
  - Pure TypeScript Cosine Similarity search ranks top 3–5 matching fragments in milliseconds.
  - Full support for live external API embeddings (e.g. OpenAI / Anthropic) via `$env/static/private`, plus an offline local vector fallback so the application works 100% out of the box.

### 2. Svelte 5 Reactive UI & Modules
- **State Primitives**: Strict compliance with Svelte 5 Runes (`$state()`, `$derived()`, `$effect()`).
- **Dashboard Overview (`/`)**: Executive statistics, core movement principles, rapid argument lookup, recent session log.
- **Ideological Repository (`/repository`)**:
  - Category filters: `magisterium`, `economics`, `geopolitics`, `rebuttals`.
  - Full-text and semantic search interface.
  - Knowledge Chunk inspector & modal to add/edit primary sources.
- **Rhetorical Shield (`/shield`)**:
  - AI Debate Assistant with pre-configured attack defense strategies ("Swiss Shield Defense", "Double Distance Strategy", "Plowshare Paradox").
  - Streamed response token rendering.
  - Reactive **Source Tracking Pane** (`$derived`) displaying retrieved primary sources, confidence scores, and encyclical citations.
- **Content Engine (`/content`)**:
  - Instant generator for social media posts: **X (Twitter) Threads**, **TikTok / Shorts Scripts**, and **Official Press Releases**.
  - One-click copy, tone customization, and formatting controls.

---

## File Structure & Proposed Changes

### Core Configuration
- [package.json](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/package.json) - Svelte 5, SvelteKit, TailwindCSS, better-sqlite3, Lucide icons.
- [svelte.config.js](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/svelte.config.js) & [vite.config.ts](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/vite.config.ts)
- [tailwind.config.js](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/tailwind.config.js) & [src/app.css](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/app.css)

### Backend & RAG System
- [src/lib/server/db.ts](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/lib/server/db.ts) - SQLite schema & connection manager.
- [src/lib/server/seedData.ts](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/lib/server/seedData.ts) - Seed dataset (Papal encyclicals, Bastiat economics, Swiss neutrality).
- [src/lib/server/rag.ts](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/lib/server/rag.ts) - In-memory VectorCache & Cosine Similarity search engine.
- [src/hooks.server.ts](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/hooks.server.ts) - SvelteKit server bootstrap hook.

### API Endpoints
- [src/routes/api/chat/+server.ts](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/routes/api/chat/+server.ts) - RAG context retrieval & streamed debate responses.
- [src/routes/api/chunks/+server.ts](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/routes/api/chunks/+server.ts) - Knowledge Base CRUD endpoint.
- [src/routes/api/content/+server.ts](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/routes/api/content/+server.ts) - Social media & press statement generator endpoint.

### UI Routes & Components
- [src/routes/+layout.svelte](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/routes/+layout.svelte) - Layout with movement header, sidebar, theme toggle, and connection badge.
- [src/routes/+page.svelte](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/routes/+page.svelte) - Executive Dashboard.
- [src/routes/repository/+page.svelte](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/routes/repository/+page.svelte) - Ideological Repository & Chunk Management.
- [src/routes/shield/+page.svelte](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/routes/shield/+page.svelte) - Rhetorical Shield AI Assistant.
- [src/routes/content/+page.svelte](file:///nun-drw-fs01/Redirects$/bzieba/Home/Documents/lemiesz/src/routes/content/+page.svelte) - Content Engine Studio.

---

## Verification Plan

### Automated Verification
1. `npx svelte-check` / `npm run check` to verify standard Svelte 5 types and syntax.
2. `npm run build` to confirm clean server-side bundle generation with SQLite native bindings.

### Manual Verification
1. **RAG Startup Verification**: Confirm `VectorCache` loads SQLite knowledge chunks into RAM on SvelteKit server initialization.
2. **Rhetorical Shield Test**: Trigger debate attacks ("Swiss Shield", "Double Distance") and verify RAG context sources update dynamically in the reactive source tracking pane.
3. **Ideological Repository Test**: Search and filter primary sources, and test adding a custom knowledge chunk.
4. **Content Generation Test**: Generate X threads and TikTok scripts, verify formatting, and test copy-to-clipboard functionality.
