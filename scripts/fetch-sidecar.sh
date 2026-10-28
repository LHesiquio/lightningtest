#!/usr/bin/env bash
# Downloads the official Ookla Speedtest CLI for this machine into
# src-tauri/binaries/. The binary is proprietary and git-ignored on purpose:
# this script fetches it locally, nothing is redistributed.
set -euo pipefail

VERSION="1.2.0"
cd "$(dirname "$0")/.."
mkdir -p src-tauri/binaries

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)   src="linux-x86_64";   triple="x86_64-unknown-linux-gnu" ;;
  Linux-aarch64)  src="linux-aarch64";  triple="aarch64-unknown-linux-gnu" ;;
  Darwin-x86_64)  src="macosx-universal"; triple="x86_64-apple-darwin" ;;
  Darwin-arm64)   src="macosx-universal"; triple="aarch64-apple-darwin" ;;
  MINGW64*|MSYS*|CYGWIN*) echo "On Windows, download the win64 zip by hand from https://www.speedtest.net/apps/cli" >&2; exit 1 ;;
  *) echo "unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

url="https://install.speedtest.net/app/cli/ookla-speedtest-${VERSION}-${src}.tgz"
echo "downloading $url"
curl -fsSL "$url" -o "$tmp/cli.tgz"
tar -xzf "$tmp/cli.tgz" -C "$tmp"

dest="src-tauri/binaries/speedtest-${triple}"
install -m 755 "$tmp/speedtest" "$dest"
echo "ok: $dest"
"$dest" --version | head -1
