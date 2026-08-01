#!/bin/bash
set -e

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
SECRET_KEY_BASE="for-test-only"
PHX_JWT_SECRET="for-test-only"
DB_POOL_SIZE="${DB_POOL_SIZE:-10}"

cd "$(dirname "$0")/.."

PGHOST='' \
MIX_ENV=seed_prod \
DATABASE_URL="$DATABASE_URL" \
SECRET_KEY_BASE="$SECRET_KEY_BASE" \
PHX_JWT_SECRET="$PHX_JWT_SECRET" \
DB_POOL_SIZE="$DB_POOL_SIZE" \
mix run scripts/seed_lite_home.exs
