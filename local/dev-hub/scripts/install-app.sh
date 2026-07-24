#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
APP_NAME='Groupher Dev Hub.app'
APP_IDENTIFIER='com.groupher.devhub'
BUILT_APP="$REPO_ROOT/local/dev-hub/src-tauri/target/release/bundle/macos/$APP_NAME"
INSTALLED_APP="/Applications/$APP_NAME"
LSREGISTER='/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'

fail() {
  echo "Dev Hub app setup failed: $*" >&2
  exit 1
}

require_macos_build_tools() {
  [[ "$(uname -s)" == 'Darwin' ]] || fail 'this target currently supports macOS only.'
  command -v xcode-select >/dev/null 2>&1 || fail 'xcode-select is unavailable.'
  xcode-select -p >/dev/null 2>&1 ||
    fail 'install Xcode Command Line Tools first with: xcode-select --install'
  command -v node >/dev/null 2>&1 ||
    fail 'install the current Node.js LTS release before running make dev.app.'
}

install_rust_if_needed() {
  if command -v cargo >/dev/null 2>&1 || [[ -x "$HOME/.cargo/bin/cargo" ]]; then
    return
  fi

  local rust_target
  case "$(uname -m)" in
    arm64) rust_target='aarch64-apple-darwin' ;;
    x86_64) rust_target='x86_64-apple-darwin' ;;
    *) fail "unsupported Mac architecture: $(uname -m)" ;;
  esac

  local rustup_dir
  rustup_dir="$(mktemp -d "${TMPDIR:-/tmp}/groupher-rustup.XXXXXX")"
  trap 'rm -rf "$rustup_dir"' EXIT

  echo 'Rust is missing; downloading the official rustup installer…'
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
    --output "$rustup_dir/rustup-init" \
    "https://static.rust-lang.org/rustup/dist/$rust_target/rustup-init"
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
    --output "$rustup_dir/rustup-init.sha256" \
    "https://static.rust-lang.org/rustup/dist/$rust_target/rustup-init.sha256"

  local expected_checksum
  local actual_checksum
  expected_checksum="$(awk '{print $1}' "$rustup_dir/rustup-init.sha256")"
  actual_checksum="$(shasum -a 256 "$rustup_dir/rustup-init" | awk '{print $1}')"
  [[ "$expected_checksum" == "$actual_checksum" ]] ||
    fail 'the downloaded rustup installer failed checksum verification.'

  chmod +x "$rustup_dir/rustup-init"
  "$rustup_dir/rustup-init" -y --profile minimal --default-toolchain stable
  rm -rf "$rustup_dir"
  trap - EXIT
}

run_yarn() {
  if command -v yarn >/dev/null 2>&1; then
    yarn "$@"
  elif command -v corepack >/dev/null 2>&1; then
    corepack yarn "$@"
  else
    fail 'Yarn is unavailable and this Node.js installation does not include Corepack.'
  fi
}

install_app_bundle() {
  [[ -d "$BUILT_APP" ]] || fail "the build did not produce $BUILT_APP"
  codesign --verify --deep --strict "$BUILT_APP" ||
    fail 'the generated application does not have a valid code signature.'

  if [[ -d "$INSTALLED_APP" ]]; then
    local installed_identifier
    installed_identifier="$(
      plutil -extract CFBundleIdentifier raw -o - "$INSTALLED_APP/Contents/Info.plist" 2>/dev/null ||
        true
    )"
    [[ "$installed_identifier" == "$APP_IDENTIFIER" ]] ||
      fail "refusing to replace an unexpected application at $INSTALLED_APP"
    osascript -e "tell application id \"$APP_IDENTIFIER\" to quit" >/dev/null 2>&1 || true

    local attempt
    for attempt in {1..50}; do
      if ! pgrep -f "$INSTALLED_APP/Contents/MacOS/groupher-dev-hub" >/dev/null 2>&1; then
        break
      fi
      sleep 0.1
    done
    pgrep -f "$INSTALLED_APP/Contents/MacOS/groupher-dev-hub" >/dev/null 2>&1 &&
      fail 'the running Dev Hub application did not quit; close it and retry.'
  fi

  ditto "$BUILT_APP" "$INSTALLED_APP"
  codesign --verify --deep --strict "$INSTALLED_APP" ||
    fail 'the installed application failed code-signature verification.'
  "$LSREGISTER" -f "$INSTALLED_APP"
  open "$INSTALLED_APP"
}

require_macos_build_tools
install_rust_if_needed
export PATH="$HOME/.cargo/bin:$PATH"

cd "$REPO_ROOT"
echo 'Installing JavaScript dependencies…'
run_yarn install --immutable

echo 'Building the production Dev Hub…'
run_yarn workspace @groupher/local-dev-hub build

echo 'Building the signed Dev Hub application…'
run_yarn workspace @groupher/local-dev-hub desktop:build -- \
  --config 'source.crates-io.replace-with="rsproxy-sparse"' \
  --config 'source.rsproxy-sparse.registry="sparse+https://rsproxy.cn/index/"'

echo 'Installing and opening Groupher Dev Hub…'
install_app_bundle
echo 'Groupher Dev Hub is ready in /Applications.'
