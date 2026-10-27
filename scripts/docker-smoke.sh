#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export POSTGRES_PASSWORD=smoketest
export APP_PORT=3999
COMPOSE=(docker compose -f docker/compose.yml -p pbcjs-smoke)
BASE="http://127.0.0.1:${APP_PORT}"

cleanup() { "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

"${COMPOSE[@]}" up -d --build

body=""
for _ in $(seq 1 60); do
  if body=$(curl -fsS "${BASE}/api/health" 2>/dev/null); then break; fi
  sleep 1
done

if ! grep -q '"db":"ok"' <<<"${body}"; then
  echo "FAIL health: ${body:-no response}"
  "${COMPOSE[@]}" logs app
  exit 1
fi

curl -fsS "${BASE}/" | grep -q '<div id="app"></div>' || { echo "FAIL index"; exit 1; }
curl -fsS "${BASE}/some/client/route" | grep -q '<div id="app"></div>' || { echo "FAIL spa fallback"; exit 1; }

echo "smoke ok: ${body}"
