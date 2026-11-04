#!/usr/bin/env bash
set -euo pipefail
export MIX_ENV=dev

mix compile --quiet

db_name="groupher_migration_smoke_${GITHUB_RUN_ID:-local}_$$"

assert_temp_database() {
  local configured_database
  configured_database="$(DB_NAME="$db_name" mix run --no-start -e 'IO.write(Application.fetch_env!(:groupher_server, GroupherServer.Repo)[:database])')"

  if [[ "$configured_database" != "$db_name" || "$configured_database" != groupher_migration_smoke_* ]]; then
    echo "Refusing migration operation: Repo database '$configured_database' is not the expected temporary database '$db_name'." >&2
    return 1
  fi
}

cleanup() {
  if assert_temp_database; then
    DB_NAME="$db_name" mix ecto.drop --quiet >/dev/null 2>&1 || true
  else
    echo "Temporary database cleanup refused because the resolved database name changed." >&2
  fi
}
trap cleanup EXIT

assert_temp_database
DB_NAME="$db_name" mix ecto.create --quiet
assert_temp_database
DB_NAME="$db_name" mix ecto.migrate --quiet
assert_temp_database

status="$(DB_NAME="$db_name" mix ecto.migrations)"
if ! grep -q '^  up        20261104110000  remove_comment_origin_community$' <<<"$status"; then
  printf '%s\n' "$status"
  echo "Fresh database migration did not apply remove_comment_origin_community" >&2
  exit 1
fi

if ! grep -q '^  up        20261104120000  create_production_seed_ledger$' <<<"$status"; then
  printf '%s\n' "$status"
  echo "Fresh database migration did not apply create_production_seed_ledger" >&2
  exit 1
fi

echo "Fresh database migrations passed through create_production_seed_ledger."
