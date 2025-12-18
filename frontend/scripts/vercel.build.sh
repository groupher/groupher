#!/usr/bin/env bash

echo "GIT DIR CHECK:"
ls -la .git || echo "No .git folder, git commands will fail"

set -e

PROJECT_NAME="${VERCEL_PROJECT_NAME:-}"
APP_NAME="${PROJECT_NAME##*-}"
APP_NAME="${APP_NAME:-$CURRENT_APP}"

echo "🔹 Current app: $APP_NAME"

COMMIT_MSG=$(git log -1 --pretty=%B)
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
# 运行构建或安全跳过
# ---------------------------
if [ "$SHOULD_DEPLOY" = true ]; then
  echo "✅ Deploy switch ON for app: $APP_NAME"
  yarn workspace @groupher/frontend-$APP_NAME build
  BUILD_EXIT_CODE=$?
  if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo "❌ Build failed for $APP_NAME"
    exit $BUILD_EXIT_CODE
  fi
else
  echo "⏭️ Deploy switch OFF for app: $APP_NAME — skipping build"
fi

# 脚本最终 exit 0，保证 Vercel 不因跳过报错
exit 0