# DevFlow Infrastructure

`infra/docker/docker-compose.yml` is the local development stack.

```bash
cp infra/.env.example .env
pnpm infra:up
```

The default stack starts PostgreSQL, API, and Web. Redis and Mailpit are
available for future integrations, but the API does not use them yet:

```bash
pnpm infra:up:integrations
```

Redis is available on `localhost:6380` by default to avoid colliding with an
existing local Redis instance. Change `REDIS_PORT` in `.env` when necessary.

Nginx is an optional local reverse proxy:

```bash
WEB_ORIGIN=http://localhost:8080 \
NEXT_PUBLIC_API_URL=http://localhost:8080 \
TRUST_PROXY=1 \
pnpm infra:up:proxy
```

Use the proxy configuration only for local verification. A public deployment
also requires TLS termination and production-specific secrets.
