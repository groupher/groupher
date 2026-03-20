#!/bin/bash
set -e

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
SECRET_KEY_BASE="for-test-only"
GUARDIAN_KEY="for-test-only"
DB_POOL_SIZE="${DB_POOL_SIZE:-10}"

if [ -z "$1" ]; then
  echo "Usage: $0 <slug>"
  exit 1
fi

SLUG="$1"

cd "$(dirname "$0")/.."

PGHOST='' \
MIX_ENV=seed_prod \
DATABASE_URL="$DATABASE_URL" \
SECRET_KEY_BASE="$SECRET_KEY_BASE" \
GUARDIAN_KEY="$GUARDIAN_KEY" \
DB_POOL_SIZE="$DB_POOL_SIZE" \
mix run scripts/seed_full_community.exs "$SLUG"
