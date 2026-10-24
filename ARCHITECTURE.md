# DevFlow Architecture

## API

`apps/api/src/modules/<feature>` contains the HTTP routes, business service,
repository, and policy for one domain. Shared technical code belongs in
`apps/api/src/core`; database schema remains in `core/db/schema`.

## Web

`apps/web/src/app` contains Next.js routing only. Product code lives in
`features/<feature>/components`. Reusable application chrome is in
`shared/components`, browser integrations in `shared/lib`, and shared CSS
modules in `shared/styles`.

Features may import `shared` and `packages/shared`, but should not import
another feature's internal components. Cross-feature interactions go through
the API client or a deliberately shared abstraction.
