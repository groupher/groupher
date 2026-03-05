#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <slug>"
  exit 1
fi

SLUG="$1"

cd "$(dirname "$0")/.."

MIX_ENV=mock mix run scripts/delete_full_community.exs "$SLUG"
