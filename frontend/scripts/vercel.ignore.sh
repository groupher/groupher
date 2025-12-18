#!/usr/bin/env bash

# -------------------------------------------------------------
# VERCEL IGNORE SCRIPT
#
# Checks the latest commit message for [deploy:<app>] tags.
# Decides whether to skip the build or let Vercel run it.
#
# Flow:
#   +-----------------------+
#   | Latest Commit Message |
#   +-----------------------+
#               |
#               v
#   +----------------------------+
#   | Contains [deploy:app]?    |
#   +----------------------------+
#       |                |
#      Yes              No
#       |                |
#       v                v
# Run Build Command    Skip Build
# (exit 1)             (exit 0)
# -------------------------------------------------------------

# check commit message
COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null || echo "")

APPS=("landing" "dashboard" "main" "gateway")

# skip by default
SKIP_BUILD=true

for APP in "${APPS[@]}"; do
  if echo "$COMMIT_MSG" | grep -iq "\[deploy:$APP\]"; then
    SKIP_BUILD=false
    break
  fi
done

if [ "$SKIP_BUILD" = true ]; then
  echo "⏭️ No deploy label found, skipping build"
  exit 0
else
  echo "✅ Deploy label found, running build"
  exit 1
fi
