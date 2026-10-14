# DevFlow

DevFlow is a modular monolith project management SaaS. The first version is intentionally small: one Next.js web app, one Express API, and shared TypeScript/Zod contracts.

## Structure

```txt
apps/
  api/      Express API
  web/      Next.js App Router frontend
packages/
  config/   Shared TypeScript configuration
  shared/   Shared schemas, DTOs, and types
docs/
  adr/      Architecture Decision Records
infra/
  docker/   Local infrastructure later
```

## Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
```

## Local URLs

- Web: http://localhost:3000
- API: http://localhost:4000
- API healthcheck: http://localhost:4000/healthz

