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
mix run -e "slug = List.first(System.argv()) || raise \"Usage: mix run -e <expr> <slug>\"; IO.puts(\"Creating lightweight full community with slug: #{slug}\"); case GroupherServer.CMS.Seeds.full_community(slug, article_count_per_thread: 6, comment_count_range: {5, 6}, article_upvotes_range: {0, 1}, comment_upvotes_range: {0, 0}, comment_replies_range: {0, 0}, tag_count_range: {5, 8}) do {:ok, community} -> IO.puts(\"✓ Lightweight full community created successfully!\"); IO.puts(\"  slug: #{community.slug}\"); IO.puts(\"  id: #{community.id}\"); {:error, reason} -> IO.puts(\"✗ Failed to create lightweight full community: #{inspect(reason)}\"); System.halt(1) end" "$SLUG"
