# DevFlow Infrastructure

`infra/docker/docker-compose.yml` is the local development stack.

```bash
cp infra/.env.example .env
pnpm infra:up
```

The default stack starts PostgreSQL, Redis, Mailpit, API, and Web. Redis stores
the rate-limit counters shared by API instances. Mailpit receives local
workspace invitation emails at [http://localhost:8025](http://localhost:8025).

For production, replace `DOCKER_SMTP_HOST`, `DOCKER_SMTP_PORT`, `SMTP_SECURE`,
`SMTP_FROM`, `SMTP_USER`, and `SMTP_PASSWORD` with values from the email
provider. Keep SMTP credentials in deployment secrets, never in Git.

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
