#!/bin/bash
subapp_name=$1
if [ -z "$subapp_name" ]; then
  echo "Error: Subapp name is required."
  echo "Usage: bash check-version.sh <subapp_name>"
  exit 1
fi

project_root=$(cd "$(dirname "$0")/../.." && pwd)
echo "Project root directory: $project_root"

package_path="$project_root/frontend/$subapp_name/package.json"
echo "Checking package.json at: $package_path"

if [ ! -f "$package_path" ]; then
  echo "Error: $package_path does not exist."
  exit 1
fi

if ! git ls-files --error-unmatch "$package_path" > /dev/null 2>&1; then
  echo "File is not tracked by Git, triggering build."
  exit 1
fi

current_version=$(grep -E '"version":' "$package_path" | awk '{print $2}' | tr -d '",')
echo "Current version: $current_version"

if git log -1 -- "$package_path" > /dev/null 2>&1; then
  previous_content=$(git show HEAD^:"$package_path" 2>/dev/null)
  if [ -z "$previous_content" ]; then
    echo "File is newly added or not in previous commit, triggering build."
    exit 1
  fi
  previous_version=$(echo "$previous_content" | grep -E '"version":' | awk '{print $2}' | tr -d '",')
  echo "Previous version: $previous_version"
else
  echo "File is not in Git history, triggering build."
  exit 1
fi

if [ "$current_version" != "$previous_version" ]; then
  echo "Version change detected in $package_path (from $previous_version to $current_version), triggering build."
  exit 1
else
  echo "No version change in $package_path, skipping build."
  exit 0
fi

