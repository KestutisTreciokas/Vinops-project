#!/usr/bin/env bash
set -euo pipefail
fail=0
for url in \
  "https://vinops.online/en" \
  "https://vinops.online/api/v1/health" \
  "https://vinops.online/sitemap.xml" \
  "https://vinops.online/robots.txt"
do
  code="$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo 000)"
  echo "$code  $url"
  [[ "$code" =~ ^2..$ ]] || fail=1
done
exit $fail
