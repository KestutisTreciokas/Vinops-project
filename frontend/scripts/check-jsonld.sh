#!/usr/bin/env bash
set -euo pipefail
DOMAIN=vinops.online
VIN="${1:-WAUZZZAAAAAAAAAAA}"
for L in en ru; do
  HTML="$(curl -ksS --compressed --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/${L}/vin/${VIN}?_bust=$RANDOM")"
  echo "${L}: $(printf '%s' "$HTML" | grep -o 'id=\"ld-vehicle\"' | wc -l) script(s)"
done
