#!/usr/bin/env bash

# -------------------------------------------------------------
# VERCEL BUILD SCRIPT
#
# Builds the current app workspace.
# Only runs if ignoreCommand allowed it.
#
# Flow:
#   +-----------------------+
#   | Vercel runs Build Cmd |
#   +-----------------------+
#               |
#               v
#   +------------------------+
#   | Yarn Workspace Build   |
#   | @groupher/frontend-$APP|
#   +------------------------+
#       |            |
#   Success        Fail
#       |            |
#       v            v
#  🎉 Build Done   ❌ Exit 1
# -------------------------------------------------------------

set -e

PROJECT_NAME="${VERCEL_PROJECT_NAME:-}"
APP_NAME="${PROJECT_NAME##*-}"
APP_NAME="${APP_NAME:-$CURRENT_APP}"

echo "🔹 Current building app: $APP_NAME"

echo "🏗️ Running build..."
yarn workspace @groupher/frontend-$APP_NAME build || {
  echo "❌ Build failed for $APP_NAME"
  exit 1
}

echo "🎉 Build finished for $APP_NAME"
