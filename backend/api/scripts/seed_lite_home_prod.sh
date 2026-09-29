#!/bin/bash
set -e

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
SECRET_KEY_BASE="for-test-only"
PHX_JWT_SECRET="for-test-only"
VIEW_TRACKER_PEPPER="seed-prod-view-tracker-pepper"
DB_POOL_SIZE="${DB_POOL_SIZE:-10}"

cd "$(dirname "$0")/.."

PGHOST='' \
MIX_ENV=seed_prod \
DATABASE_URL="$DATABASE_URL" \
SECRET_KEY_BASE="$SECRET_KEY_BASE" \
PHX_JWT_SECRET="$PHX_JWT_SECRET" \
VIEW_TRACKER_PEPPER="$VIEW_TRACKER_PEPPER" \
DB_POOL_SIZE="$DB_POOL_SIZE" \
mix run scripts/seed_lite_home.exs
