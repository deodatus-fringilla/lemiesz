# ==========================================
# Multi-stage Dockerfile for Pakt Lemiesza
# Supports AMD64 and ARM64 architectures
# ==========================================

# Stage 1: Build & Dependencies
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native bindings
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code and config
COPY . .

# Run production build via @sveltejs/adapter-node
RUN pnpm build

# Prune devDependencies to keep image lean
RUN pnpm prune --prod

# ==========================================
# Stage 2: Production Runner
# ==========================================
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/lemiesz.db

# Ensure persistent directory exists for SQLite WAL database
RUN mkdir -p /data && chown -R node:node /data

# Copy built application and production dependencies
COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node

EXPOSE 3000

VOLUME ["/data"]

CMD ["node", "build/index.js"]
