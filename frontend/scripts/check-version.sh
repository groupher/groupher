#!/bin/bash
# 通用脚本：检查指定子应用的 package.json 版本是否变更
# 使用方法：bash check-version.sh <子应用名称>

# 获取子应用名称
subapp_name=$1
if [ -z "$subapp_name" ]; then
  echo "Error: Subapp name is required."
  echo "Usage: bash check-version.sh <subapp_name>"
  exit 1
fi

cd "$(dirname "$0")/.." || exit 1

package_path="$subapp_name/package.json"

if [ ! -f "$package_path" ]; then
  echo "Error: $package_path does not exist."
  exit 1
fi

if git diff --quiet HEAD^ HEAD -- "$package_path"; then
  echo "No changes in $package_path, skipping build."
  exit 0
else
  old_version=$(git show HEAD^:"$package_path" | grep -E '"version":' | awk '{print $2}' | tr -d '",')
  new_version=$(git show HEAD:"$package_path" | grep -E '"version":' | awk '{print $2}' | tr -d '",')
  if [ "$old_version" != "$new_version" ]; then
    echo "Version change detected in $package_path (from $old_version to $new_version), triggering build."
    exit 1
  else
    echo "No version change in $package_path, skipping build."
    exit 0
  fi
fi
