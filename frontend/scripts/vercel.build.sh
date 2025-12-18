#!/usr/bin/env bash
set -e

# ---------------------------
# 1. 确定当前 app 名
# ---------------------------
PROJECT_NAME="${VERCEL_PROJECT_NAME:-}"
APP_NAME="${PROJECT_NAME##*-}"
APP_NAME="${APP_NAME:-$CURRENT_APP}"

if [ -z "$APP_NAME" ]; then
  echo "❌ Cannot determine current app. Set VERCEL_PROJECT_NAME or CURRENT_APP."
  exit 1
fi

echo "🔹 Current app inferred as: $APP_NAME"

# ---------------------------
# 2. 获取最新 commit message
# ---------------------------
COMMIT_MSG=$(git log -1 --pretty=%B)
echo "🔹 Latest commit message:"
echo "$COMMIT_MSG"
echo

# ---------------------------
# 3. 提取所有 deploy 标签
# ---------------------------
DEPLOY_LABELS=$(echo "$COMMIT_MSG" | grep -oP '\[deploy:\K[^\]]+')

# 拆分逗号并整理成数组
DEPLOY_APPS=()
for label in $DEPLOY_LABELS; do
  IFS=',' read -ra apps <<< "$label"
  for app in "${apps[@]}"; do
    # 去除可能的空格
    app_trimmed=$(echo "$app" | xargs)
    DEPLOY_APPS+=("$app_trimmed")
  done
done

# ---------------------------
# 4. 输出 commit 中将被部署的 app 列表
# ---------------------------
if [ ${#DEPLOY_APPS[@]} -eq 0 ]; then
  echo "ℹ️  No [deploy:...] labels found. No app will be deployed."
else
  echo "📌 Apps requested to deploy in this commit: ${DEPLOY_APPS[*]}"
fi
echo

# ---------------------------
# 5. 判断当前 app 是否在列表里
# ---------------------------
SHOULD_DEPLOY=false
for app in "${DEPLOY_APPS[@]}"; do
  if [ "$app" = "$APP_NAME" ]; then
    SHOULD_DEPLOY=true
    break
  fi
done

# ---------------------------
# 6. 执行或跳过
# ---------------------------
if [ "$SHOULD_DEPLOY" = true ]; then
  echo "✅ Deploy switch ON for app: $APP_NAME"
  echo "🏗️  Running build for $APP_NAME..."
  yarn workspace @groupher/frontend-$APP_NAME build
  echo "🎉 Build finished for $APP_NAME"
else
  echo "⏭️  Deploy switch OFF for app: $APP_NAME — skipping build"
fi
