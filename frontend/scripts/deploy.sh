#!/usr/bin/env bash
set -euo pipefail
cd /root/work/vinops.restore
DC="-f docker-compose.prod.yml"; [ -f docker-compose.db.yml ] && DC="$DC -f docker-compose.db.yml"
docker compose -p vinopsrestore $DC build web
docker compose -p vinopsrestore $DC up -d web
