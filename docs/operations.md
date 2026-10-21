# DevFlow Operations Runbook

This runbook covers the Docker Compose deployment used by DevFlow. It is a
baseline for a single environment; production credentials and backups must be
managed outside the repository.

## Production Checklist

- Store every value from `.env` in the deployment secret manager. Do not copy
  `.env` to an image or commit it to Git.
- Use unique, long values for `POSTGRES_PASSWORD`,
  `POSTGRES_MIGRATOR_PASSWORD`, `POSTGRES_RUNTIME_PASSWORD`, session secrets,
  and SMTP credentials.
- Set `NODE_ENV=production`, a public `WEB_ORIGIN`, `COOKIE_SECURE=true`, and
  `TRUST_PROXY=1` only behind a trusted TLS reverse proxy.
- Configure a real SMTP provider. Mailpit is for local development only.
- Keep PostgreSQL, Redis, API, and web ports private. Expose only the TLS
  reverse proxy to the internet.
- Monitor `GET /healthz` for process availability and `GET /readyz` for
  PostgreSQL and Redis availability.

## Backup

Create a custom-format PostgreSQL dump:

```bash
pnpm db:backup
```

Backups are written to `backups/postgres` by default and are ignored by Git.
Move successful dumps to durable, encrypted off-host storage. A local Docker
volume is not a backup. The default retention period is 14 days; configure a
different schedule and retention window for the production recovery target.

Example daily schedule on the deployment host:

```cron
0 2 * * * cd /srv/devflow && /usr/bin/pnpm db:backup -- --output-dir /var/backups/devflow/postgres --retention-days 30
```

The backup command validates every dump with `pg_restore --list` before it
reports success.

## Restore Drill

Practice this process against a non-production environment before relying on
it during an incident.

1. Put the application into maintenance mode and stop API instances so no new
   writes reach PostgreSQL.
2. Retrieve the selected backup from off-host storage and validate its
   provenance and timestamp.
3. Run the explicit restore command:

   ```bash
   pnpm db:restore -- --file /secure/path/devflow-20261021T020000Z.dump --confirm
   ```

4. Start the API. Its migrator applies any newer migrations before the runtime
   service starts.
5. Verify `GET /readyz`, authenticate with a test account, and inspect the
   application logs for migration or authorization errors.
6. Record the backup timestamp, restore time, data-loss window, and follow-up
   actions in the incident report.

`db:restore` validates the dump first and requires `--confirm`; it replaces
the configured database with `pg_restore --clean`.

## Secret Rotation

Rotate one credential class at a time and retain a tested rollback window.

1. Create a new secret in the deployment secret manager.
2. Update the matching deployment environment value and restart the dependent
   service.
3. Verify `/readyz`, an authenticated API request, and SMTP delivery where
   applicable.
4. Revoke the old credential after the new value has operated successfully.

For PostgreSQL role passwords, update `POSTGRES_MIGRATOR_PASSWORD` and
`POSTGRES_RUNTIME_PASSWORD` together with every connection URL that contains
them, then run `db-bootstrap` through a Compose deployment. Rotate the
bootstrap `POSTGRES_PASSWORD` in a maintenance window because it is also used
by the PostgreSQL container initialization account.
