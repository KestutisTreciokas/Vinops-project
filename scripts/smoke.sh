#!/usr/bin/env bash
set -euo pipefail

DOMAIN="vinops.online"
HOSTIP="127.0.0.1"
PROJECT="-f docker-compose.prod.yml -p vinopsrestore"

retry() {
  local tries=${1:-30}; shift
  local delay=${1:-1}; shift
  local i=0
  until "$@"; do
    i=$((i+1))
    if [ "$i" -ge "$tries" ]; then
      echo "Retry failed after ${tries} attempts" >&2
      return 1
    fi
    sleep "$delay"
  done
}

echo "== Wait: web:3000 becomes ready via caddy upstream =="
retry 40 1 docker compose $PROJECT exec -T caddy sh -lc 'wget -qO- http://web:3000/en >/dev/null 2>&1'

echo
echo "== HTTP -> HTTPS redirect (308) =="
curl -sS -D- -o /dev/null -H "Host: ${DOMAIN}" "http://127.0.0.1/en" | sed -n '1,20p'

echo
echo "== HTTPS /en through Caddy (expect 200) =="
curl -k --resolve "${DOMAIN}:443:${HOSTIP}" -sS -D- -o /dev/null "https://${DOMAIN}/en" | sed -n '1,20p'

echo
echo "== HTTPS /sitemap.xml (expect 200) =="
curl -k --resolve "${DOMAIN}:443:${HOSTIP}" -sS -D- -o /dev/null "https://${DOMAIN}/sitemap.xml" | sed -n '1,20p'

echo
echo "== Upstream caddy -> web:3000 (expect 200) =="
docker compose $PROJECT exec -T caddy wget -S -qO- http://web:3000/en 2>&1 | sed -n '1,20p' || true

echo
echo "== In-container web port 3000 listener =="
docker compose $PROJECT exec -T web sh -lc 'netstat -ltnp 2>/dev/null | grep :3000 || ss -ltnp 2>/dev/null | grep :3000 || true'
