#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
VERSION=${1:?'usage: scripts/build-release.sh <version>'}
VERSION=${VERSION#v}
TAG="v${VERSION}"
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

LDFLAGS="-s -w -X github.com/ossianhempel/things3-cli/internal/cli.Version=${TAG}"

for arch in arm64 amd64; do
  OUT_DIR="$DIST_DIR/things-${VERSION}-darwin-${arch}"
  mkdir -p "$OUT_DIR"
  GOOS=darwin GOARCH=$arch CGO_ENABLED=0 \
    go build -trimpath -ldflags "$LDFLAGS" -o "$OUT_DIR/things" ./cmd/things
  (cd "$OUT_DIR" && tar -czf "$DIST_DIR/things-${VERSION}-darwin-${arch}.tar.gz" things)
  rm -rf "$OUT_DIR"
done

( cd "$DIST_DIR" && shasum -a 256 *.tar.gz > checksums.txt )

echo "Release artifacts written to $DIST_DIR"
