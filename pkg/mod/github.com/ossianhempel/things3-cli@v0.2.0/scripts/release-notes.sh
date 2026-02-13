#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
VERSION=${1:?'usage: scripts/release-notes.sh <version>'}
VERSION=${VERSION#v}

NOTES=$(awk -v ver="$VERSION" '
  $0 ~ "^## " {
    if (found) exit
    if (index($0, "## [" ver "]") == 1) {found=1; next}
  }
  found {print}
' "$ROOT_DIR/CHANGELOG.md")

if [[ -z "${NOTES//[$'\t\n\r ']/}" ]]; then
  echo "ERROR: No changelog entries found for version $VERSION" >&2
  exit 1
fi

echo "$NOTES"
