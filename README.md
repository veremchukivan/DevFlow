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
  docker/   Docker Compose and image definitions
  .env.example  Environment variable template
```

## Commands

```bash
pnpm install
cp infra/.env.example .env
pnpm infra:up
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Database

Local PostgreSQL runs through Docker Compose:

```bash
cp infra/.env.example .env
# Update POSTGRES_PASSWORD, DATABASE_URL, and DOCKER_DATABASE_URL together.
pnpm infra:up
```

Docker applies migrations through the `api-migrate` service before starting the
API. PostgreSQL, API, and web ports are bound to `127.0.0.1`, so they are only
reachable from this computer. Use a reverse proxy and a production-specific
Compose configuration for public deployment.

The default local connection string in `infra/.env.example` is:

```txt
postgres://devflow:replace-with-a-unique-local-password@localhost:5432/devflow
```

## Test Database

API integration tests use a separate PostgreSQL database:

```txt
postgres://devflow:replace-with-a-unique-local-password@localhost:5432/devflow_test
```

Prepare it manually:

```bash
pnpm db:test:prepare
```

`pnpm test` also runs this preparation step before Vitest.

## Local URLs

- Web: http://localhost:3000
- API: http://localhost:4000
- API healthcheck: http://localhost:4000/healthz
- API readiness: http://localhost:4000/readyz

## API Documentation

Endpoint examples and role rules live in [docs/api.md](docs/api.md).

## Auth Endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/email-verification/resend`
- `POST /api/v1/auth/email-verification/confirm`
- `GET /api/v1/auth/me`

## Workspace Endpoints

- `POST /api/v1/workspaces`
- `GET /api/v1/workspaces`
- `GET /api/v1/workspaces/:workspaceId`

## Workspace Member Endpoints

- `GET /api/v1/workspaces/:workspaceId/members`
- `POST /api/v1/workspaces/:workspaceId/members`
- `PATCH /api/v1/workspaces/:workspaceId/members/:userId`
- `DELETE /api/v1/workspaces/:workspaceId/members/:userId`

## Workspace Invitation Endpoints

- `POST /api/v1/workspaces/:workspaceId/invitations`
- `GET /api/v1/workspaces/:workspaceId/invitations`
- `DELETE /api/v1/workspaces/:workspaceId/invitations/:invitationId`
- `POST /api/v1/workspaces/:workspaceId/invitations/:invitationId/resend`
- `GET /api/v1/invitations/:token`
- `POST /api/v1/invitations/:token/accept`
- `POST /api/v1/invitations/:token/decline`

## Project Endpoints

- `POST /api/v1/workspaces/:workspaceId/projects`
- `GET /api/v1/workspaces/:workspaceId/projects`
- `GET /api/v1/workspaces/:workspaceId/projects/:projectId`

## Task Endpoints

- `POST /api/v1/workspaces/:workspaceId/projects/:projectId/tasks`
- `GET /api/v1/workspaces/:workspaceId/projects/:projectId/tasks`
- `GET /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId`
- `PATCH /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId`
- `DELETE /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId`

## Task Comment Endpoints

- `POST /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments`
- `GET /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments`
- `PATCH /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments/:commentId`
- `DELETE /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments/:commentId`

## Task Activity Endpoints

- `GET /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/activity`

