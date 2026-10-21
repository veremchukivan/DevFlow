#!/usr/bin/env bash

set -Eeuo pipefail

compose_file="infra/docker/docker-compose.yml"
env_file=".env"
backup_file=""
confirmed=false

usage() {
  cat <<'EOF'
Usage: pnpm db:restore -- --file PATH --confirm [options]

Restore a PostgreSQL custom-format dump into the configured Docker Compose database.
The current application database is replaced. Stop the API before running this command.

Options:
  --file PATH             Backup created by db:backup (required)
  --env-file PATH         Docker environment file (default: .env)
  --confirm               Required acknowledgement that the target database is replaced
  --help                  Show this message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      ;;
    --file)
      backup_file="$2"
      shift 2
      ;;
    --env-file)
      env_file="$2"
      shift 2
      ;;
    --confirm)
      confirmed=true
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  printf 'A readable --file is required\n' >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  printf 'Environment file not found: %s\n' "$env_file" >&2
  exit 1
fi

if [[ "$confirmed" != true ]]; then
  printf 'Restore requires --confirm because it replaces the target database\n' >&2
  exit 1
fi

if ! docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  pg_restore --list < "$backup_file" > /dev/null; then
  printf 'Backup validation failed; restore was not started\n' >&2
  exit 1
fi

docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  sh -ec 'exec env PGPASSWORD="$POSTGRES_MIGRATOR_PASSWORD" pg_restore -U devflow_migrator -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' \
  < "$backup_file"

printf 'Restore completed. Start the API and verify /readyz before accepting traffic.\n'
