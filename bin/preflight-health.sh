#!/usr/bin/env bash
set -euo pipefail

echo "[preflight] scanning for legacy /api/v1/health ..."

# Исключаем служебные каталоги
EXCLUDE_DIRS=( ".git" "node_modules" ".backup*" )

EX_OPTS=()
for d in "${EXCLUDE_DIRS[@]}"; do
  EX_OPTS+=( --exclude-dir="$d" )
done

MATCHES="$(grep -RIn "${EX_OPTS[@]}" --include='*.yml' --include='*.yaml' '/api/v1/health' . || true)"

if [[ -n "$MATCHES" ]]; then
  echo "[preflight][FAIL] Found legacy references to /api/v1/health:"
  echo "$MATCHES"
  exit 1
fi

echo "[preflight][OK] No legacy references in YAML."
exit 0
