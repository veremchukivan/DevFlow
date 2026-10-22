# -----------------------------------------------------------------------------
# Base stage: Enable pnpm and prepare environment
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# -----------------------------------------------------------------------------
# Pruner stage: Prune monorepo for @devflow/web
# -----------------------------------------------------------------------------
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2.0.0
COPY . .
RUN turbo prune @devflow/web --docker

# -----------------------------------------------------------------------------
# Builder stage: Install dependencies and build Next.js standalone
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# First install dependencies (cached unless lockfile/manifests change)
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Copy full source and build Next.js application
COPY --from=pruner /app/out/full/ .
COPY packages/config ./packages/config
RUN pnpm --filter @devflow/shared build
RUN pnpm --filter @devflow/web build

# -----------------------------------------------------------------------------
# Development stage: Next.js dev server for Docker Compose Watch
# -----------------------------------------------------------------------------
FROM base AS development
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/config/package.json ./packages/config/package.json
RUN pnpm install --frozen-lockfile

COPY . .

ENV NODE_ENV=development
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["pnpm", "--filter", "@devflow/web", "dev", "--hostname", "0.0.0.0"]

# -----------------------------------------------------------------------------
# Runner stage: Minimal production image
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone Next.js server & static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "apps/web/server.js"]
