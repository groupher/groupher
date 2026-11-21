#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

export MIX_ENV=test
db_name="groupher_passport_ref_migration_$(date +%s)_$$"
export TEST_DB_NAME="$db_name"
created=0

assert_target_database() {
  local configured_database
  configured_database="$(mix run --no-compile --no-start -e 'IO.write(Application.fetch_env!(:groupher_server, GroupherServer.Repo)[:database])')"

  if [[ "$configured_database" != "$db_name" || "$configured_database" != groupher_passport_ref_migration_* ]]; then
    echo "Refusing Passport ref migration operation: Repo database '$configured_database' is not the expected temporary database." >&2
    return 1
  fi
}

cleanup() {
  if [[ "$created" == 1 ]]; then
    if assert_target_database; then
      mix ecto.drop --quiet >/dev/null 2>&1 || true
    else
      echo "Temporary database cleanup refused because the resolved database name changed." >&2
    fi
  fi
}
trap cleanup EXIT

mix compile --quiet
assert_target_database
mix ecto.create --quiet
created=1
assert_target_database
mix run --no-start scripts/passport_ref_migration_verify.exs
