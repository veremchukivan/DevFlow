#!/usr/bin/env bash

set -Eeuo pipefail

compose_file="infra/docker/docker-compose.yml"
env_file=".env"
output_dir="backups/postgres"
retention_days="14"

usage() {
  cat <<'EOF'
Usage: pnpm db:backup -- [options]

Create a PostgreSQL custom-format dump through the Docker Compose postgres service.

Options:
  --output-dir PATH       Directory for backup files (default: backups/postgres)
  --retention-days DAYS   Delete older backup files after a successful dump (default: 14)
  --env-file PATH         Docker environment file (default: .env)
  --help                  Show this message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      ;;
    --output-dir)
      output_dir="$2"
      shift 2
      ;;
    --retention-days)
      retention_days="$2"
      shift 2
      ;;
    --env-file)
      env_file="$2"
      shift 2
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

if [[ ! -f "$env_file" ]]; then
  printf 'Environment file not found: %s\n' "$env_file" >&2
  exit 1
fi

if [[ ! "$retention_days" =~ ^[0-9]+$ ]]; then
  printf '--retention-days must be a non-negative integer\n' >&2
  exit 1
fi

mkdir -p "$output_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$output_dir/devflow-${timestamp}.dump"

docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  sh -ec 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  > "$backup_file"

if [[ ! -s "$backup_file" ]]; then
  rm -f "$backup_file"
  printf 'Backup failed: generated file is empty\n' >&2
  exit 1
fi

if ! docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  pg_restore --list < "$backup_file" > /dev/null; then
  rm -f "$backup_file"
  printf 'Backup failed validation and was removed\n' >&2
  exit 1
fi

find "$output_dir" -type f -name 'devflow-*.dump' -mtime "+$retention_days" -delete
printf 'Backup created and validated: %s\n' "$backup_file"
