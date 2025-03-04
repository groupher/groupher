#!/bin/bash
# 获取子应用名称
subapp_name=$1
if [ -z "$subapp_name" ]; then
  echo "Error: Subapp name is required."
  echo "Usage: bash check-version.sh <subapp_name>"
  exit 1
fi

# 定位到项目根目录
project_root=$(cd "$(dirname "$0")/../.." && pwd)
echo "Project root directory: $project_root"

# 子应用的 package.json 路径
package_path="$project_root/frontend/$subapp_name/package.json"
echo "Checking package.json at: $package_path"

# 检查 package.json 是否存在
if [ ! -f "$package_path" ]; then
  echo "Error: $package_path does not exist."
  exit 1
fi

# 检查文件是否被 Git 跟踪
if ! git ls-files --error-unmatch "$package_path" > /dev/null 2>&1; then
  echo "File is not tracked by Git, triggering build."
  exit 1
fi

# 获取当前版本的 version 字段
current_version=$(grep -E '"version":' "$package_path" | awk '{print $2}' | tr -d '",')
echo "Current version: $current_version"

# 获取上一次提交的 version 字段（如果存在）
if git log -1 -- "$package_path" > /dev/null 2>&1; then
  # 获取上一次提交的文件内容
  previous_content=$(git show HEAD^:"$package_path" 2>/dev/null)
  if [ -z "$previous_content" ]; then
    echo "File is not in previous commit, triggering build."
    exit 1
  fi
  previous_version=$(echo "$previous_content" | grep -E '"version":' | awk '{print $2}' | tr -d '",')
  echo "Previous version: $previous_version"
else
  echo "File is not in Git history, triggering build."
  exit 1
fi

# 检查 version 字段是否变更
if [ "$current_version" != "$previous_version" ]; then
  echo "Version change detected in $package_path (from $previous_version to $current_version), triggering build."
  exit 1
else
  echo "No version change in $package_path, skipping build."
  exit 0
fi

