#!/usr/bin/env bash
set -euo pipefail
URL="${1:-http://127.0.0.1:3000/api/v1/health}"
echo "→ GET $URL"
OUT="$(curl -fsS "$URL")"
echo "$OUT"
echo "$OUT" | grep -q '"status":"ok"' && echo "✓ ok"
