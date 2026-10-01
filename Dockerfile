# ==========================================
# Pakt Lemiesza — multi-stage image (linux/amd64 and linux/arm64)
# Build the image ON the architecture you deploy to, or use `docker buildx --platform`.
# ==========================================

# ---- Stage 1: build --------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app

# Toolchain fallback in case a native module has no prebuilt binary for this architecture
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# pnpm version is pinned by "packageManager" in package.json
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN corepack enable && corepack install
RUN pnpm install --frozen-lockfile

COPY . .
# Note: the Paraglide plugin fetches the inlang message-format plugin from a CDN at build time.
RUN pnpm build
RUN pnpm prune --prod

# ---- Stage 2: runtime ------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/data/lemiesz.db \
    MODEL_CACHE_DIR=/data/models

# /data must be a LOCAL volume: SQLite WAL does not work on network filesystems
RUN mkdir -p /data && chown -R node:node /data

COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
# Operator tool: docker compose exec app node scripts/restore-drill.mjs /data/backups --boot
COPY --chown=node:node scripts/restore-drill.mjs ./scripts/restore-drill.mjs

USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "build/index.js"]
