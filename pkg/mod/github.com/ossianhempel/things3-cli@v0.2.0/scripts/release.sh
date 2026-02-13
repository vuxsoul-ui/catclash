#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
VERSION=${1:?'usage: scripts/release.sh <version>'}
VERSION=${VERSION#v}
TAG="v${VERSION}"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI (gh) is required for releases." >&2
  exit 1
fi

if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
  echo "ERROR: Working tree is dirty. Commit or stash changes before releasing." >&2
  exit 1
fi

"$ROOT_DIR/scripts/build-release.sh" "$VERSION"
"$ROOT_DIR/scripts/release-notes.sh" "$VERSION" > "$ROOT_DIR/dist/release-notes.md"

gh release create "$TAG" \
  --title "things3-cli $TAG" \
  --notes-file "$ROOT_DIR/dist/release-notes.md" \
  "$ROOT_DIR/dist"/*.tar.gz \
  "$ROOT_DIR/dist/checksums.txt"
