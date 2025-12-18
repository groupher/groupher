#!/usr/bin/env bash
set -e

# ---------------------------
# 1. 确定当前 app 名
# ---------------------------
PROJECT_NAME="${VERCEL_PROJECT_NAME:-}"

# export CURRENT_APP=landing
APP_NAME="${PROJECT_NAME##*-}"
APP_NAME="${APP_NAME:-$CURRENT_APP}"

if [ -z "$APP_NAME" ]; then
  echo "Cannot determine current app. Set VERCEL_PROJECT_NAME or CURRENT_APP."
  exit 1
fi

echo "Current app inferred as: $APP_NAME"

# ---------------------------
# 2. get latest commit message
# ---------------------------
COMMIT_MSG=$(git log -1 --pretty=%B)
echo ">> Latest commit message:"
echo "$COMMIT_MSG"

# ---------------------------
# 3. check [deploy:all]
# ---------------------------
if echo "$COMMIT_MSG" | grep -q "\[deploy:all\]"; then
  echo ">> Deploy ALL apps enabled"
  exit 0
fi

# ---------------------------
# 4. check [deploy:<app>]
# ---------------------------
if echo "$COMMIT_MSG" | grep -q "\[deploy:$APP_NAME\]"; then
  echo ">> Deploy switch ON for app: $APP_NAME"
  exit 0
fi

echo ">> Deploy switch SKIP for app: $APP_NAME"
exit 1
