#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-vinops.online}"
VIN="${2:-WAUZZZAAAAAAAAAAA}"
LANGS="${3:-en ru}"

curl_bin="curl -ksS --compressed"
have_jq=1; command -v jq >/dev/null 2>&1 || have_jq=0

red() { printf "\033[31m%s\033[0m\n" "$*"; }
grn() { printf "\033[32m%s\033[0m\n" "$*"; }
ylw() { printf "\033[33m%s\033[0m\n" "$*"; }

fail() { red "✗ $*"; exit 1; }

extract_ld() {
  # 1) пробуем perl (самый надёжный способ)
  if command -v perl >/dev/null 2>&1; then
    perl -0777 -ne 'if (m#<script[^>]+id="ld-vehicle"[^>]*>(.*?)</script>#si) { print $1 }' "$1"
    return
  fi
  # 2) портативный awk-резерв (работает на одном длинном строковом HTML)
  awk 'BEGIN{IGNORECASE=1;RS="";ORS=""}
  {
    html=$0; l=tolower(html);
    if ((start=match(l, /<script[^>]*id="ld-vehicle"[^>]*>/))==0) { next }
    openlen=RLENGTH;
    rest=substr(html, start+openlen);
    lrest=substr(l, start+openlen);
    if ((end=match(lrest, /<\/script>/))==0) { next }
    print substr(rest, 1, end-1);
  }' "$1"
}

check_lang() {
  local L="$1" URL="https://${DOMAIN}/${L}/vin/${VIN}"
  ylw "→ ${URL}"

  local tmp="/tmp/ld.$$"
  $curl_bin "$URL" > "$tmp" || fail "HTTP запрос не удался"

  local ld; ld="$(extract_ld "$tmp" || true)"

  if [[ -z "$ld" ]]; then
    red "--- DEBUG: не нашли <script id=\"ld-vehicle\"> ---"
    head -c 300 "$tmp" | sed -e 's/[[:cntrl:]]/\n/g' | sed -n '1,20p'
    fail "Не найден JSON-LD блок ld-vehicle"
  fi

  # Базовая проверка без jq
  if ! grep -Eq '"@type"[[:space:]]*:[[:space:]]*"Vehicle"' <<<"$ld"; then
    red "--- DEBUG ld-vehicle (first 300 chars) ---"
    head -c 300 <<<"$ld" | sed -e 's/[[:cntrl:]]/\n/g' | sed -n '1,20p'
    fail "В JSON-LD нет @type=Vehicle"
  fi

  if [[ $have_jq -eq 1 ]]; then
    # Валидный JSON и есть объект Vehicle (в массиве или глубже)
    echo "$ld" | jq -e . >/dev/null 2>&1 || { fail "JSON-LD не парсится jq"; }
    echo "$ld" | jq -e '[(..|objects|select(."@type"=="Vehicle"))] | length>0' >/dev/null \
      || fail "jq: объект Vehicle не найден"
    # НЕ обязательно, но полезно: хлебные крошки
    echo "$ld" | jq -e '[(..|objects|select(."@type"=="BreadcrumbList"))] | length>=1' >/dev/null \
      && grn "✓ ОК (${L}): Vehicle + BreadcrumbList" \
      || grn "✓ ОК (${L}): Vehicle (BreadcrumbList не обязателен)"
  else
    grn "✓ ОК (${L}): Vehicle (jq не установлен)"
  fi

  rm -f "$tmp"
}

main() { for L in $LANGS; do check_lang "$L"; done; grn "Все проверки пройдены ✔"; }
main "$@"
