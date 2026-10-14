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
docker compose up -d postgres
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
```

## Database

Local PostgreSQL runs through Docker Compose:

```bash
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate
```

The default local connection string is:

```txt
postgres://devflow:devflow@localhost:5432/devflow
```

## Local URLs

- Web: http://localhost:3000
- API: http://localhost:4000
- API healthcheck: http://localhost:4000/healthz
- API readiness: http://localhost:4000/readyz

## Auth Endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

## Workspace Endpoints

- `POST /api/v1/workspaces`
- `GET /api/v1/workspaces`
- `GET /api/v1/workspaces/:workspaceId`

## Project Endpoints

- `POST /api/v1/workspaces/:workspaceId/projects`
- `GET /api/v1/workspaces/:workspaceId/projects`
- `GET /api/v1/workspaces/:workspaceId/projects/:projectId`

