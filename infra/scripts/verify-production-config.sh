#!/usr/bin/env bash

set -Eeuo pipefail

env_file=".env"

usage() {
  cat <<'EOF'
Usage: pnpm infra:verify-production -- [--env-file PATH]

Validate the security-critical environment values required by the Docker Compose
production deployment. Secret values are never printed.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
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

get_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$env_file"
}

errors=0

require_value() {
  local key="$1"
  if [[ -z "$(get_value "$key")" ]]; then
    printf 'Missing required production value: %s\n' "$key" >&2
    errors=1
  fi
}

require_value "WEB_ORIGIN"
require_value "NEXT_PUBLIC_API_URL"
require_value "COOKIE_SECURE"
require_value "DOCKER_REDIS_URL"
require_value "SMTP_FROM"
require_value "DOCKER_SMTP_HOST"
require_value "INTEGRATION_ENCRYPTION_KEY"
require_value "POSTGRES_DB"
require_value "POSTGRES_USER"
require_value "POSTGRES_PASSWORD"
require_value "POSTGRES_MIGRATOR_PASSWORD"
require_value "POSTGRES_RUNTIME_PASSWORD"
require_value "DOCKER_MIGRATION_DATABASE_URL"
require_value "DOCKER_RUNTIME_DATABASE_URL"

if [[ "$(get_value "NODE_ENV")" != "production" ]]; then
  printf 'NODE_ENV must be production\n' >&2
  errors=1
fi

if [[ "$(get_value "COOKIE_SECURE")" != "true" ]]; then
  printf 'COOKIE_SECURE must be true in production\n' >&2
  errors=1
fi

web_origin="$(get_value "WEB_ORIGIN")"
if [[ -n "$web_origin" && ! "$web_origin" =~ ^https:// ]]; then
  printf 'WEB_ORIGIN must use https:// in production\n' >&2
  errors=1
fi

public_api_url="$(get_value "NEXT_PUBLIC_API_URL")"
if [[ -n "$public_api_url" && ! "$public_api_url" =~ ^https:// ]]; then
  printf 'NEXT_PUBLIC_API_URL must use https:// in production\n' >&2
  errors=1
fi

if [[ "$(get_value "DOCKER_SMTP_HOST")" == "mailpit" ]]; then
  printf 'DOCKER_SMTP_HOST must not point to Mailpit in production\n' >&2
  errors=1
fi

encryption_key="$(get_value "INTEGRATION_ENCRYPTION_KEY")"
if [[ -n "$encryption_key" ]]; then
  key_length="$(printf '%s' "$encryption_key" | base64 --decode 2>/dev/null | wc -c | tr -d ' ')"
  if [[ "$key_length" != "32" ]]; then
    printf 'INTEGRATION_ENCRYPTION_KEY must decode to exactly 32 bytes\n' >&2
    errors=1
  fi
fi

figma_client_id="$(get_value "FIGMA_CLIENT_ID")"
figma_client_secret="$(get_value "FIGMA_CLIENT_SECRET")"
figma_redirect_uri="$(get_value "FIGMA_REDIRECT_URI")"
figma_count=0
[[ -n "$figma_client_id" ]] && ((figma_count += 1))
[[ -n "$figma_client_secret" ]] && ((figma_count += 1))
[[ -n "$figma_redirect_uri" ]] && ((figma_count += 1))
if [[ "$figma_count" != "0" && "$figma_count" != "3" ]]; then
  printf 'Configure all Figma OAuth values together or leave all three empty\n' >&2
  errors=1
fi

if [[ "$figma_count" == "3" && ! "$figma_redirect_uri" =~ ^https:// ]]; then
  printf 'FIGMA_REDIRECT_URI must use https:// in production\n' >&2
  errors=1
fi

if [[ "$errors" -ne 0 ]]; then
  printf 'Production configuration validation failed. No secret values were printed.\n' >&2
  exit 1
fi

printf 'Production configuration validation passed.\n'
