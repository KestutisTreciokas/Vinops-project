#!/usr/bin/env bash
# vinops.online — Diagnostic Snapshot Generator
# Mode: read-only (writes ONLY under context/context-TS-Europe_Warsaw)
# Exit code must be 0 in all cases.

set +e +u

# --------- Defaults ---------
SNAP_TZ="Europe/Warsaw"
TS="$(TZ="$SNAP_TZ" date '+%Y-%m-%d_%H%M%S')"
HOST=""
LOGS_N=400

detect_repo() {
  # Try git top-level, otherwise PWD
  local r
  r="$(git rev-parse --show-toplevel 2>/dev/null)"
  if [ -z "$r" ]; then r="$PWD"; fi
  echo "$r"
}

REPO="$(detect_repo)"
OUT="$REPO"

# --------- Args ---------
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2;;
    --host) HOST="$2"; shift 2;;
    --logs) LOGS_N="$2"; shift 2;;
    --out)  OUT="$2"; shift 2;;
    *) echo "[WARN] Unknown arg: $1" >&2; shift 1;;
  esac
done

# Normalize absolute paths
REPO="$(cd "$REPO" 2>/dev/null && pwd || echo "$REPO")"
OUT="$(cd "$OUT" 2>/dev/null && pwd || echo "$OUT")"

# --------- Snapshot dir ---------
SNAP_DIR="$OUT/context/context-${TS}-${SNAP_TZ}"
# Idempotent: re-create same dir if exists
rm -rf "$SNAP_DIR" 2>/dev/null || true
mkdir -p "$SNAP_DIR" || true

# Utilities
wfile() {
  # $1: relative path under SNAP_DIR
  mkdir -p "$(dirname "$SNAP_DIR/$1")" 2>/dev/null || true
  : > "$SNAP_DIR/$1"
}

run_to() {
  # $1: file relative path; remainder: command...
  local target="$1"; shift
  mkdir -p "$(dirname "$SNAP_DIR/$target")" 2>/dev/null || true
  {
    echo "## CMD: $*"
    echo "## TIME($SNAP_TZ): $(TZ="$SNAP_TZ" date '+%Y-%m-%d %H:%M:%S %Z')"
    "$@" 2>&1 || echo "[WARN] command failed: $*"
  } > "$SNAP_DIR/$target"
}

safe_grep_headers() {
  # filter common security headers + basics
  egrep -i '^(HTTP/|server:|date:|content-type:|content-length:|cache-control:|etag:|last-modified:|strict-transport-security:|content-security-policy:|referrer-policy:|x-content-type-options:|x-frame-options:|vary:|link:|x-api-version:|x-ratelimit-)'
}

mask_urls() {
  # hide credentials/hosts in git remotes or env lines
  sed -E 's#(https?://|git@)[^/\s]+#***#g'
}

hash_or_skip() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" 2>/dev/null || true
  else
    echo "sha256sum not available"
  fi
}

list_env_keys_only() {
  # stdin: lines KEY=VALUE -> print unique KEYs
  sed -E 's/=.*$//' | sed -E 's/^[[:space:]]+|[[:space:]]+$//g' | grep -E '^[A-Za-z0-9_]+$' | sort -u
}

# --------- README ---------
wfile "README.txt"
{
  echo "vinops.online — Diagnostic Snapshot"
  echo "Time (TZ=$SNAP_TZ): $(TZ="$SNAP_TZ" date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "Repo: $REPO"
  echo "Out:  $OUT"
  echo "Host: ${HOST:-<none>}"
  echo "Logs tail: $LOGS_N lines"
  echo ""
  echo "All files are read-only collected. Any secrets masked as *** or not stored."
} >> "$SNAP_DIR/README.txt"

# --------- 1. Host/OS ---------
run_to "host/os.txt" bash -lc 'lsb_release -a 2>/dev/null || cat /etc/os-release 2>/dev/null || true'
run_to "host/uname.txt" bash -lc 'uname -a || true'
run_to "host/cpu.txt"   bash -lc 'lscpu || true'
run_to "host/mem.txt"   bash -lc 'free -h || true'
run_to "host/df.txt"    bash -lc 'df -h || true'
run_to "host/time.txt"  bash -lc '"'"'echo "Local: $(date)"; TZ="Europe/Warsaw" date'"'"''

# --------- 2. Git ---------
run_to "git/branch_status.txt" bash -lc 'git -C "'"$REPO"'" rev-parse --abbrev-ref HEAD && echo && git -C "'"$REPO"'" status --porcelain=v1 -b || true'
run_to "git/log_last30.txt"    bash -lc 'git -C "'"$REPO"'" log --oneline -n 30 || true'
run_to "git/tags.txt"          bash -lc 'git -C "'"$REPO"'" tag -l | sort || true'
run_to "git/remote.txt"        bash -lc 'git -C "'"$REPO"'" remote -v | mask_urls || true'
run_to "git/gitignore.txt"     bash -lc '[ -f "'"$REPO"'/.gitignore" ] && cat "'"$REPO"'/.gitignore" || echo "<no .gitignore>"'
run_to "git/top_large_files.txt" bash -lc 'cd "'"$REPO"'" && find . -type f -not -path "./.git/*" -printf "%s\t%p\n" 2>/dev/null | sort -nr | head -n 50 || true'

# --------- 3. Repo layout ---------
run_to "repo/layout.txt" bash -lc '
cd "'"$REPO"'" || exit 0
dirs="frontend backend app public docker infra db collector scripts contracts"
for d in $dirs; do
  [ -d "$d" ] || continue
  part="no"
  ls "$d"/Dockerfile* "$d"/docker-compose* "$d"/next.config.* "$d"/package.json  >/dev/null 2>&1 && part="yes"
  echo "$d  participates:$part"
done
echo
echo "tree (max depth 2) for key dirs:"
for d in $dirs; do
  [ -d "$d" ] || continue
  echo "## $d"
  find "$d" -maxdepth 2 -type d -print 2>/dev/null | sed "s#^#  #"
done
'

# --------- 4. Node/JS toolchain ---------
run_to "node/toolchain.txt" bash -lc '
( node -v || echo "node: MISSING" )
( npm -v  || echo "npm: MISSING" )
( pnpm -v || echo "pnpm: MISSING" )
( yarn -v || echo "yarn: MISSING" )
( npx --version || echo "npx: MISSING" )
( tsc -v || echo "tsc: MISSING" )
( next -v || echo "next: MISSING" )
'

# --------- 5. Package manifest ---------
run_to "node/packages.txt" bash -lc '
cd "'"$REPO"'" || exit 0
for f in package.json frontend/package.json app/package.json; do
  if [ -f "$f" ]; then
    echo "### $f"
    cat "$f"
    echo
  fi
done
echo "### lock files (name + sha256 if available)"
for f in package-lock.json pnpm-lock.yaml yarn.lock frontend/package-lock.json frontend/pnpm-lock.yaml frontend/yarn.lock; do
  if [ -f "$f" ]; then
    echo "--- $f"
    hash_or_skip "$f"
  fi
done
echo
echo "### npm scripts (root + frontend)"
for f in package.json frontend/package.json; do
  if [ -f "$f" ]; then
    echo ">> $f scripts:"
    node -e "const p=require('$f'); console.log(p.scripts?Object.keys(p.scripts).join(', '):'<none>')" 2>/dev/null || true
  fi
done
'

# --------- 6. Docker/Compose ---------
run_to "docker/version.txt"         bash -lc 'docker version || true'
run_to "docker/compose_version.txt" bash -lc 'docker compose version || true'
run_to "docker/compose_config.txt"  bash -lc '
cd "'"$REPO"'" || exit 0
for f in docker-compose.yml docker-compose.prod.yml docker-compose.override.yml; do
  [ -f "$f" ] && echo "### $f" && docker compose -f "$f" config 2>&1 || true
done
'
run_to "docker/compose_ps.txt"      bash -lc 'cd "'"$REPO"'" || exit 0; for f in docker-compose.yml docker-compose.prod.yml; do [ -f "$f" ] && echo "### $f" && docker compose -f "$f" ps; done'
run_to "docker/images.txt"          bash -lc 'docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" || true'
run_to "docker/ports.txt"           bash -lc 'ss -tulpn | grep LISTEN || true'

# --------- 7. Container inspect (env KEYS only) ---------
run_to "docker/inspect_env_keys.txt" bash -lc '
names="$(docker ps --format "{{.Names}}" 2>/dev/null)"
echo "containers: $names"
for pat in web app frontend db postgres proxy caddy nginx; do
  for n in $names; do
    case "$n" in *"$pat"*)
      echo "### $n (pattern:$pat)"
      docker inspect "$n" 2>/dev/null | jq -r ".[0].Config.Env[]" 2>/dev/null | list_env_keys_only || true
      echo
    ;; esac
  done
done
' 

# --------- 8. Next.js/SSR artifacts ---------
run_to "next/artifacts.txt" bash -lc '
cd "'"$REPO"'/frontend" 2>/dev/null || exit 0
if [ -d ".next" ]; then
  echo ".next exists"
  du -sh .next 2>/dev/null || true
  echo
  for f in ".next/server/app-paths-manifest.json" ".next/server/middleware-manifest.json"; do
    [ -f "$f" ] && echo "== $f ==" && head -n 60 "$f"
  done
  echo
  echo "routes (server/app/*) up to 3 levels:"
  find .next/server/app -maxdepth 3 -type f -print 2>/dev/null | sed "s#^#  #"
else
  echo ".next: NOT FOUND"
fi
'

# --------- 9. HTTP public checks (if --host) ---------
if [ -n "$HOST" ]; then
  run_to "http/HEAD_root.txt"        bash -lc 'curl -sI "'"$HOST"'/"        | safe_grep_headers || true'
  run_to "http/HEAD_robots.txt"      bash -lc 'curl -sI "'"$HOST"'/robots.txt" | safe_grep_headers || true'
  run_to "http/HEAD_sitemap.xml"     bash -lc 'curl -sI "'"$HOST"'/sitemap.xml" | safe_grep_headers || true'
  run_to "http/HEAD_sitemaps_vin.txt" bash -lc '
    for p in /sitemaps/vin.xml /sitemaps/vin/en-0.xml /sitemaps/vin/ru-0.xml; do
      echo "### $p"
      curl -sI "'"$HOST""$p" | safe_grep_headers || true
      echo
    done
  '
fi

# --------- 10. SEO/static (public) ---------
run_to "seo/public_inventory.txt" bash -lc '
cd "'"$REPO"'/frontend" 2>/dev/null || exit 0
if [ -d public ]; then
  find public -maxdepth 3 -type f | head -n 300
else
  echo "public/: NOT FOUND"
fi
'
run_to "seo/ldjson_scan.txt" bash -lc '
cd "'"$REPO"'/frontend" 2>/dev/null || exit 0
grep -RIl --include="*.html" -n '"'"'application/ld+json'"'"' public 2>/dev/null || echo "No static HTML with ld+json under public/"
'
run_to "seo/static_cache_samples.txt" bash -lc '
[ -n "'"$HOST"'" ] || { echo "HOST not provided"; exit 0; }
for p in / /robots.txt /sitemap.xml; do
  echo "### $p"
  curl -sI "'"$HOST""$p" | egrep -i "^(HTTP/|cache-control:|etag:|last-modified:)" || true
  echo
done
'

# --------- 11. Database (Postgres) ---------
run_to "db/overview.txt" bash -lc '
proj="$(basename "'"$REPO"'")"
# Try to find likely DB container by name pattern:
cand="$(docker ps --format "{{.Names}}" 2>/dev/null | tr " " "\n" | grep -E "(db|postgres)" | head -n1)"
if [ -z "$cand" ]; then
  echo "UNKNOWN: no running container matched (db|postgres). How to check: docker ps | grep -E '\''(db|postgres)'\''"
  exit 0
fi
echo "DB container: $cand"
echo "Trying psql..."
docker exec -T "$cand" psql -U postgres -d postgres -c "\conninfo" 2>/dev/null || echo "UNKNOWN: psql failed. How to check: docker exec -T $cand psql -U <user> -d <db> -c '\conninfo'"
echo
docker exec -T "$cand" psql -U postgres -d postgres -c "\dn" 2>/dev/null || true
echo
docker exec -T "$cand" psql -U postgres -d postgres -c "\dt *.*" 2>/dev/null | head -n 120 || true
echo
docker exec -T "$cand" psql -U postgres -d postgres -c "select schemaname,relname,pg_total_relation_size(relid) as bytes from pg_catalog.pg_statio_user_tables order by 3 desc limit 20" 2>/dev/null || true
echo
docker exec -T "$cand" psql -U postgres -d postgres -c "select datname, numbackends from pg_stat_database order by numbackends desc" 2>/dev/null || true
'

# --------- 12. Reverse proxy / TLS ---------
run_to "proxy/configs.txt" bash -lc '
cd "'"$REPO"'" || exit 0
for f in caddy/Caddyfile nginx/nginx.conf nginx/conf.d/*.conf; do
  [ -f "$f" ] && { echo "### $f"; sed -n "1,200p" "$f"; echo; }
done
'
run_to "proxy/tls_s_client.txt" bash -lc '
[ -n "'"$HOST"'" ] || { echo "HOST not provided"; exit 0; }
host="$(echo "'"$HOST"'" | sed -E "s#^https?://##" | sed "s#/$##")"
openssl s_client -servername "$host" -connect "$host:443" -brief </dev/null 2>/dev/null | head -n 40 || echo "[WARN] openssl s_client failed"
'

# --------- 13. Jobs/CRON/systemd ---------
run_to "jobs/cron.txt"    bash -lc 'crontab -l 2>/dev/null || echo "<no crontab>"'
run_to "jobs/systemd.txt" bash -lc 'systemctl list-units --type=service 2>/dev/null | grep -E "cron|timer|node|docker|nginx|caddy" || true'
run_to "jobs/scripts.txt" bash -lc 'cd "'"$REPO"'" || exit 0; find scripts -maxdepth 2 -type f 2>/dev/null || echo "<no scripts/>"'

# --------- 14. Logs tail ---------
run_to "logs/web.txt"   bash -lc 'cd "'"$REPO"'" || exit 0; for f in docker-compose.yml docker-compose.prod.yml; do [ -f "$f" ] && docker compose -f "$f" logs --tail '"$LOGS_N"' web 2>/dev/null && break; done || true'
run_to "logs/db.txt"    bash -lc 'cd "'"$REPO"'" || exit 0; for f in docker-compose.yml docker-compose.prod.yml; do [ -f "$f" ] && docker compose -f "$f" logs --tail '"$LOGS_N"' db 2>/dev/null && break; done || true'
run_to "logs/proxy.txt" bash -lc 'cd "'"$REPO"'" || exit 0; for svc in caddy nginx proxy; do for f in docker-compose.yml docker-compose.prod.yml; do [ -f "$f" ] && docker compose -f "$f" logs --tail '"$LOGS_N"' "$svc" 2>/dev/null && exit 0; done; done; true'

# --------- 15. Configs & env (masked) ---------
run_to "configs/compose_and_build.txt" bash -lc '
cd "'"$REPO"'" || exit 0
for f in docker-compose*.yml frontend/Dockerfile Dockerfile frontend/next.config.* next.config.* frontend/tsconfig.* tsconfig.*; do
  for g in $f; do
    [ -f "$g" ] && { echo "### $g"; sed -n "1,200p" "$g"; echo; }
  done
done
'
run_to "configs/env_keys.txt" bash -lc '
cd "'"$REPO"'" || exit 0
for f in .env .env.local .env.production .env.example .env.sample frontend/.env frontend/.env.local; do
  [ -f "$f" ] || continue
  echo "### $f (keys only, values masked)"
  sed -E "s/(^|\r|\n)([A-Za-z0-9_]+)=.*/\1\2=***/g" "$f" | sed -n "1,200p"
  echo
done
'

# --------- 16. UNKNOWN & risks summary ---------
run_to "summary/unknown_and_risks.txt" bash -lc '
# Simple heuristics
echo "UNKNOWN/RISKS SUMMARY:"
[ -d "'"$REPO"'/frontend/.next" ] || echo "- NEXT build artifacts: UNKNOWN (How to check: run next build; inspect frontend/.next)"
[ -n "'"$HOST"'" ] || echo "- HOST not provided: HTTP checks skipped (How to check: run with --host https://vinops.online)"
docker ps >/dev/null 2>&1 || echo "- Docker not reachable (How to check: docker ps)"
cand="$(docker ps --format "{{.Names}}" 2>/dev/null | tr " " "\n" | grep -E "(db|postgres)" | head -n1)"
[ -n "$cand" ] || echo "- DB container not found (How to check: docker ps | grep -E '\''(db|postgres)'\'' )"
'

# --------- Pack the snapshot ---------
ARCHIVE="$OUT/context/context-${TS}-${SNAP_TZ}.tar.gz"
tar -C "$OUT" -czf "$ARCHIVE" "context/context-${TS}-${SNAP_TZ}" 2>/dev/null || true

echo
echo "[INFO] Snapshot directory: $SNAP_DIR"
echo "[INFO] Archive:           $ARCHIVE"
exit 0
