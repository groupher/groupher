#!/usr/bin/env bash
set -e

PROJECT_NAME="${VERCEL_PROJECT_NAME:-}"
APP_NAME="${PROJECT_NAME##*-}"
APP_NAME="${APP_NAME:-$CURRENT_APP}"

if [ -z "$APP_NAME" ]; then
  echo "❌ Cannot determine current app. Set VERCEL_PROJECT_NAME or CURRENT_APP."
  exit 1
fi

COMMIT_MSG=$(git log -1 --pretty=%B)
echo "🔹 Current app: $APP_NAME"
echo "🔹 Commit message: $COMMIT_MSG"

# 提取所有 deploy 标签
DEPLOY_LABELS=$(echo "$COMMIT_MSG" | grep -oP '\[deploy:\K[^\]]+')
DEPLOY_APPS=()
for label in $DEPLOY_LABELS; do
  IFS=',' read -ra apps <<< "$label"
  for app in "${apps[@]}"; do
    app_trimmed=$(echo "$app" | xargs)
    DEPLOY_APPS+=("$app_trimmed")
  done
done

SHOULD_DEPLOY=false
for app in "${DEPLOY_APPS[@]}"; do
  if [ "$app" = "$APP_NAME" ]; then
    SHOULD_DEPLOY=true
    break
  fi
done

# ---------------------------
# 安全执行 build 或跳过
# ---------------------------
if [ "$SHOULD_DEPLOY" = true ]; then
  echo "✅ Deploy switch ON for app: $APP_NAME"
  echo "🏗️  Running build..."
  yarn workspace @groupher/frontend-$APP_NAME build
  echo "🎉 Build finished for $APP_NAME"
else
  echo "⏭️  Deploy switch OFF for app: $APP_NAME — skipping build"
  # 🚨 非零 exit 码会让 Vercel fail，必须显式 exit 0
  exit 0
fi