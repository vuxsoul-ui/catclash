#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${E2E_PORT:-${PORT:-3000}}"
PLAYWRIGHT_LOCK_DIR="${ROOT_DIR}/.tmp/playwright-chromium-profile"

echo "[e2e-clean] Target port: ${PORT}"

if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${PIDS}" ]]; then
    echo "[e2e-clean] Stopping stale process(es) on port ${PORT}: ${PIDS}"
    kill ${PIDS} 2>/dev/null || true
    sleep 1
    STILL_RUNNING="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${STILL_RUNNING}" ]]; then
      echo "[e2e-clean] Force stopping remaining process(es): ${STILL_RUNNING}"
      kill -9 ${STILL_RUNNING} 2>/dev/null || true
    fi
  else
    echo "[e2e-clean] No listener found on port ${PORT}"
  fi
else
  echo "[e2e-clean] 'lsof' not found; skipping port cleanup"
fi

mkdir -p "${PLAYWRIGHT_LOCK_DIR}"
rm -f \
  "${PLAYWRIGHT_LOCK_DIR}/SingletonLock" \
  "${PLAYWRIGHT_LOCK_DIR}/SingletonCookie" \
  "${PLAYWRIGHT_LOCK_DIR}/SingletonSocket"
echo "[e2e-clean] Cleared local Playwright profile locks (if present)"

rm -rf "${ROOT_DIR}/.next"
echo "[e2e-clean] Cleared .next"

