#!/usr/bin/env bash

set -euo pipefail

readonly GATUS_IMAGE='ghcr.io/twin/gatus:v5.36.0'
readonly STATUS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly CONTAINER_NAME="groupher-status-config-validate-$$"

cleanup() {
  docker rm --force "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

command -v docker >/dev/null 2>&1 || {
  echo 'docker is required to validate the production Gatus configuration' >&2
  exit 1
}

docker run \
  --detach \
  --rm \
  --name "${CONTAINER_NAME}" \
  --mount "type=bind,source=${STATUS_ROOT}/config.yaml,target=/config/config.yaml,readonly" \
  --tmpfs /data \
  --publish 127.0.0.1::8080 \
  "${GATUS_IMAGE}" >/dev/null

for _ in $(seq 1 40); do
  if [[ "$(docker inspect --format '{{.State.Running}}' "${CONTAINER_NAME}" 2>/dev/null)" != 'true' ]]; then
    docker logs "${CONTAINER_NAME}" >&2
    exit 1
  fi

  status_port="$(docker port "${CONTAINER_NAME}" 8080/tcp | sed -E 's/.*:([0-9]+)$/\1/' | head -1)"
  if [[ -n "${status_port}" ]] && curl --fail --silent "http://127.0.0.1:${status_port}/health" >/dev/null; then
    echo "Gatus production config is valid with ${GATUS_IMAGE}"
    exit 0
  fi

  sleep 0.25
done

docker logs "${CONTAINER_NAME}" >&2
echo 'Gatus did not become healthy before the validation timeout' >&2
exit 1
