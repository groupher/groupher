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

case "$APP_NAME" in
  gateway)
    WORKSPACE_NAME="@groupher/gateway"
    ;;
  main | dashboard | landing)
    WORKSPACE_NAME="@groupher/frontend-$APP_NAME"
    ;;
  *)
    echo "❌ Unknown Vercel app: $APP_NAME"
    exit 1
    ;;
esac

echo "🏗️ Running build..."
yarn workspace "$WORKSPACE_NAME" build || {
  echo "❌ Build failed for $APP_NAME"
  exit 1
}

echo "🎉 Build finished for $APP_NAME"
