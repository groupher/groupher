#!/usr/bin/env bash
# frontend/scripts/vercel.ignore.sh

# 获取 commit message
COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null || echo "")

# 遍历项目名列表
APPS=("landing" "dashboard" "main" "core")

# 默认跳过
SKIP_BUILD=true

for APP in "${APPS[@]}"; do
  if echo "$COMMIT_MSG" | grep -q "\[deploy:$APP\]"; then
    # 发现有 deploy 标签 → 不跳过
    SKIP_BUILD=false
    break
  fi
done

if [ "$SKIP_BUILD" = true ]; then
  echo "⏭️ No deploy label found, skipping build"
  exit 0  # Vercel 会跳过 Build Command
else
  echo "✅ Deploy label found, running build"
  exit 1  # Vercel 执行 Build Command
fi
