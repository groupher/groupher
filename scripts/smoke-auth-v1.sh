#!/usr/bin/env bash

set -euo pipefail

: "${AUTH_SMOKE_AUTH_ENDPOINT:?Set AUTH_SMOKE_AUTH_ENDPOINT, for example https://auth.groupher.com/api/auth}"
: "${AUTH_SMOKE_PHOENIX_ENDPOINT:?Set AUTH_SMOKE_PHOENIX_ENDPOINT to the Phoenix GraphQL URL}"
: "${AUTH_SMOKE_TOKEN:?Set AUTH_SMOKE_TOKEN to a disposable V1 browser access token}"

approved_origin="${AUTH_SMOKE_APPROVED_ORIGIN:-https://dash.groupher.com}"
unapproved_origin="${AUTH_SMOKE_UNAPPROVED_ORIGIN:-https://landing.groupher.com}"
smoke_dir="$(mktemp -d)"
trap 'rm -rf "$smoke_dir"' EXIT

status="$({
  curl --silent --show-error \
    --output "$smoke_dir/phoenix-missing-proof.body" \
    --write-out '%{http_code}' \
    --request POST \
    --header 'Content-Type: application/json' \
    --header "Cookie: groupher-auth.token=${AUTH_SMOKE_TOKEN}" \
    --data '{"query":"mutation AuthV1Smoke { authV1SmokeNeverExecute }"}' \
    "$AUTH_SMOKE_PHOENIX_ENDPOINT"
})"
test "$status" = '400'

status="$({
  curl --silent --show-error \
    --output "$smoke_dir/phoenix-landing.body" \
    --write-out '%{http_code}' \
    --request POST \
    --header 'Content-Type: application/json' \
    --header 'X-Groupher-CSRF: 1' \
    --header "Origin: ${unapproved_origin}" \
    --header "Cookie: groupher-auth.token=${AUTH_SMOKE_TOKEN}" \
    --data '{"query":"mutation AuthV1Smoke { authV1SmokeNeverExecute }"}' \
    "$AUTH_SMOKE_PHOENIX_ENDPOINT"
})"
test "$status" = '400'

status="$({
  curl --silent --show-error \
    --dump-header "$smoke_dir/auth-approved.headers" \
    --output "$smoke_dir/auth-approved.body" \
    --write-out '%{http_code}' \
    --request OPTIONS \
    --header "Origin: ${approved_origin}" \
    --header 'Access-Control-Request-Method: POST' \
    --header 'Access-Control-Request-Headers: content-type,x-groupher-csrf' \
    "${AUTH_SMOKE_AUTH_ENDPOINT}/token/refresh"
})"
test "$status" = '204'
grep -Fqi "access-control-allow-origin: ${approved_origin}" "$smoke_dir/auth-approved.headers"
grep -Fqi 'access-control-allow-credentials: true' "$smoke_dir/auth-approved.headers"
grep -Fqi 'vary: Origin' "$smoke_dir/auth-approved.headers"

curl --silent --show-error \
  --dump-header "$smoke_dir/auth-unapproved.headers" \
  --output "$smoke_dir/auth-unapproved.body" \
  --request OPTIONS \
  --header "Origin: ${unapproved_origin}" \
  --header 'Access-Control-Request-Method: POST' \
  --header 'Access-Control-Request-Headers: content-type,x-groupher-csrf' \
  "${AUTH_SMOKE_AUTH_ENDPOINT}/token/refresh"

if grep -Fqi 'access-control-allow-origin:' "$smoke_dir/auth-unapproved.headers"; then
  echo 'Unapproved Auth origin unexpectedly received ACAO.' >&2
  exit 1
fi

echo 'Auth V1 deployment smoke passed.'
