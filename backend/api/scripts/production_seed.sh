#!/usr/bin/env bash
# Release RPC only. Requests contain metadata/paths, never a credential or Cookie.
set -euo pipefail
if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo 'Usage: RELEASE_BIN=/app/bin/groupher_server production_seed.sh request.json' >&2
  exit 64
fi
seed_request_bytes=$(wc -c < "$1")
if (( seed_request_bytes > 16384 )); then
  echo 'Request metadata exceeds 16 KiB' >&2
  exit 64
fi
seed_request_b64=$(base64 < "$1" | tr -d '\n')
seed_release_bin=${RELEASE_BIN:-/app/bin/groupher_server}
exec "$seed_release_bin" rpc "GroupherServer.CMS.ProductionSeed.CLI.run_base64(\"$seed_request_b64\")"
