# -----------------------------------------------------------------------------
# Base stage: Enable pnpm and prepare environment
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# -----------------------------------------------------------------------------
# Pruner stage: Prune monorepo for @devflow/api
# -----------------------------------------------------------------------------
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2.0.0
COPY . .
RUN turbo prune @devflow/api --docker

# -----------------------------------------------------------------------------
# Builder stage: Install dependencies and compile
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# First install dependencies (cached unless lockfile/manifests change)
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Copy full source and build packages
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @devflow/shared build
RUN pnpm --filter @devflow/api build

# -----------------------------------------------------------------------------
# Runner stage: Minimal production image
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=4000

# Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 devflow

# Copy package manifests and workspace node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api ./apps/api

USER devflow
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.API_PORT || 4000) + '/healthz').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]

