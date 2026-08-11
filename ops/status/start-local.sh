#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config_path="${GATUS_CONFIG_PATH:-$repo_root/ops/status/config.local.yaml}"

if [[ -n "${GATUS_BIN:-}" ]]; then
  gatus_bin="$GATUS_BIN"
elif command -v gatus >/dev/null 2>&1; then
  gatus_bin="$(command -v gatus)"
elif command -v go >/dev/null 2>&1; then
  gatus_bin="$(go env GOPATH)/bin/gatus"
else
  echo "Gatus is not installed. Install it with: go install github.com/TwiN/gatus/v5@v5.36.0" >&2
  exit 127
fi

if [[ ! -x "$gatus_bin" ]]; then
  echo "Gatus binary not found at $gatus_bin. Install it with: go install github.com/TwiN/gatus/v5@v5.36.0" >&2
  exit 127
fi

cd "$repo_root"
mkdir -p "$(dirname "$config_path")"
export GATUS_CONFIG_PATH="$config_path"
exec "$gatus_bin"
