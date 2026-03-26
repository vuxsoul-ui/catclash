#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${E2E_PORT:-${PORT:-3000}}"

if [[ -z "${BASE_URL:-}" ]]; then
  export BASE_URL="http://127.0.0.1:${PORT}"
fi

echo "[e2e-safe] BASE_URL=${BASE_URL}"
echo "[e2e-safe] E2E_PORT=${PORT}"

bash "${ROOT_DIR}/scripts/e2e-local-clean.sh"

cd "${ROOT_DIR}"
npx playwright test "$@"

