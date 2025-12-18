#!/usr/bin/env bash
set -e

PROJECT_NAME="${VERCEL_PROJECT_NAME:-}"
APP_NAME="${PROJECT_NAME##*-}"
APP_NAME="${APP_NAME:-$CURRENT_APP}"

echo "🔹 Current app: $APP_NAME"

COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null || echo "")
echo "🔹 Commit message: $COMMIT_MSG"

echo "🔹 debug 00"
# 提取所有 deploy 标签
# DEPLOY_LABELS=$(echo "$COMMIT_MSG" | grep -oP '\[deploy:\K[^\]]+')
DEPLOY_LABELS=()
while [[ "$COMMIT_MSG" =~ \[deploy:([^\]]+)\] ]]; do
  DEPLOY_LABELS+=("${BASH_REMATCH[1]}")
  COMMIT_MSG=${COMMIT_MSG#*${BASH_REMATCH[0]}}
done
echo "🔹 debug 0"
DEPLOY_APPS=()
echo "🔹 debug 1"
for label in $DEPLOY_LABELS; do
 echo "🔹 debug 2"
  IFS=',' read -ra apps <<< "$label"
  for app in "${apps[@]}"; do
    app_trimmed=$(echo "$app" | xargs)
    DEPLOY_APPS+=("$app_trimmed")
  done
done

echo "🔹 debug 3"
SHOULD_DEPLOY=false
for app in "${DEPLOY_APPS[@]}"; do
  if [ "$app" = "$APP_NAME" ]; then
    SHOULD_DEPLOY=true
    break
  fi
done

echo "🔹 debug 4"
# 执行或跳过
if [ "$SHOULD_DEPLOY" = true ]; then
  echo "✅ Deploy switch ON for app: $APP_NAME"
  yarn workspace @groupher/frontend-$APP_NAME build || {
    echo "❌ Build failed for $APP_NAME"
    exit 1
  }
  echo "🎉 Build finished for $APP_NAME"
else
  echo "⏭️ Deploy switch OFF for app: $APP_NAME — skipping build"
fi

echo "🔹 debug 5"
# 最终保证 exit 0
exit 0