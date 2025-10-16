#!/usr/bin/env bash
# diag.sh — безопасный снимок состояния проекта/окружения
# Политики: read-only/идемпотентно, запись только в context/, маскирование секретов.
set +e +u

TZ_EU="Europe/Warsaw"

_log()  { echo "[$(TZ=$TZ_EU date '+%F %T %Z')] $*"; }
_warn() { echo "WARN: $*" >&2; }
_abspath() { (cd "$1" 2>/dev/null && pwd -P) || echo "$1"; }

# ---- ПАРСИНГ АРГУМЕНТОВ ----
REPO=""
HOST=""
LOGS="400"
OUT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2;;
    --host) HOST="$2"; shift 2;;
    --logs) LOGS="$2"; shift 2;;
    --out)  OUT="$2";  shift 2;;
    *) _warn "Unknown arg: $1"; shift;;
  esac
done

# Автоопределение репо
if [ -z "$REPO" ]; then
  if command -v git >/dev/null 2>&1; then
    ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
    [ -n "$ROOT" ] && REPO="$ROOT" || REPO="$PWD"
  else
    REPO="$PWD"
  fi
fi
REPO="$(_abspath "$REPO")"

# Каталог вывода
if [ -z "$OUT" ]; then
  OUT="$REPO"
fi
OUT="$(_abspath "$OUT")"

STAMP="$(TZ=$TZ_EU date '+%Y-%m-%d_%H%M%S-Europe_Warsaw')"
SNAP="$OUT/context/context-$STAMP"
ARCH="$OUT/context/context-$STAMP.tar.gz"

mkdir -p "$SNAP" 2>/dev/null || true

# README снимка
{
  echo "Snapshot:       $SNAP"
  echo "Archive:        $ARCH"
  echo "Repo:           $REPO"
  echo "Host (optional):${HOST:-<none>}"
  echo "Logs tail:      $LOGS"
  echo "Time (local):   $(date)"
  echo "Time (Europe/Warsaw): $(TZ=$TZ_EU date)"
} > "$SNAP/README.txt" 2>/dev/null || true

# Утилиты наличия
_have() { command -v "$1" >/dev/null 2>&1; }

# Маски для секретов
_mask_urls()   { sed -E 's#(https?://)[^/@]+@#\1***@#g'; }
_mask_envfile(){ sed -nE 's/^\s*([A-Za-z_][A-Za-z0-9_]*).*/\1=***/p'; }

# Раздел 1: Host/OS
{
  (lsb_release -a 2>/dev/null || cat /etc/os-release 2>/dev/null || echo "UNKNOWN OS")
  uname -a 2>/dev/null || true
  lscpu 2>/dev/null || true
  free -h 2>/dev/null || true
  df -h 2>/dev/null || true
  echo "Local time: $(date)"
  echo "Europe/Warsaw: $(TZ=$TZ_EU date)"
} > "$SNAP/01_host_os.txt" 2>/dev/null || true

# Раздел 2: Git
mkdir -p "$SNAP/02_git" 2>/dev/null || true
if _have git && [ -d "$REPO/.git" ]; then
  (cd "$REPO" && {
    git rev-parse --abbrev-ref HEAD 2>/dev/null > "$SNAP/02_git/branch.txt" || true
    git status --porcelain=v1 --untracked-files=normal 2>/dev/null > "$SNAP/02_git/status.txt" || true
    git --no-pager log --decorate=short --date=iso --pretty=format:'%h %ad %an %d %s' -n 30 2>/dev/null > "$SNAP/02_git/log_last_30.txt" || true
    git tag --list --sort=-creatordate 2>/dev/null | head -n 200 > "$SNAP/02_git/tags.txt" || true
    git remote -v 2>/dev/null | _mask_urls > "$SNAP/02_git/remotes.txt" || true
    [ -f .gitignore ] && cp -f .gitignore "$SNAP/02_git/gitignore.txt" || true
    # топ крупные файлы (без .git)
    find . -path ./.git -prune -o -type f -printf '%s\t%p\n' 2>/dev/null \
      | sort -nr | head -n 200 > "$SNAP/02_git/top_files_by_size.tsv" || true
  }) 2>/dev/null
else
  echo "UNKNOWN (no git repo at $REPO)" > "$SNAP/02_git/branch.txt"
fi

# Раздел 3: Repo layout
{
  echo "# layout (participates=yes|no)"
  for d in frontend backend app public docker infra db collector scripts contracts; do
    path="$REPO/$d"
    [ -d "$path" ] || { echo "$d: no"; continue; }
    markers="$(ls "$path" 2>/dev/null | grep -E 'Dockerfile|docker-compose|next\.config|package\.json' || true)"
    if [ -n "$markers" ]; then echo "$d: yes ($markers)"; else echo "$d: no"; fi
  done
} > "$SNAP/03_repo_layout.txt" 2>/dev/null || true

# Раздел 4: Node/JS toolchain
{
  (node -v 2>/dev/null || echo "node: UNKNOWN")
  (npm -v 2>/dev/null || echo "npm: UNKNOWN")
  (pnpm -v 2>/dev/null || echo "pnpm: UNKNOWN")
  (yarn -v 2>/dev/null || echo "yarn: UNKNOWN")
  (npx --version 2>/dev/null || echo "npx: UNKNOWN")
  (tsc -v 2>/dev/null || echo "tsc: UNKNOWN")
  (next -v 2>/dev/null || echo "next: UNKNOWN")
} > "$SNAP/04_node_toolchain.txt" 2>/dev/null || true

# Раздел 5: Package manifest
mkdir -p "$SNAP/05_package" 2>/dev/null || true
[ -f "$REPO/package.json" ] && cp -f "$REPO/package.json" "$SNAP/05_package/package.json" || echo "no package.json" > "$SNAP/05_package/README.txt"
{
  for f in package-lock.json pnpm-lock.yaml yarn.lock; do
    if [ -f "$REPO/$f" ]; then
      printf "%-25s  " "$f"
      (sha256sum "$REPO/$f" 2>/dev/null || shasum -a 256 "$REPO/$f" 2>/dev/null || echo "(hash: UNKNOWN)") | awk '{print $1}'
    fi
  done
} > "$SNAP/05_package/lockfiles_hashes.txt" 2>/dev/null || true
# npm scripts (через node если есть)
if _have node && [ -f "$REPO/package.json" ]; then
  (cd "$REPO" && node -e 'try{console.log(JSON.stringify(require("./package.json").scripts||{},null,2))}catch(e){process.exit(0)}' 2>/dev/null) \
    > "$SNAP/05_package/npm_scripts.json" || true
fi

# Раздел 6: Docker/Compose
mkdir -p "$SNAP/06_docker" 2>/dev/null || true
(docker version 2>&1 || echo "docker: UNKNOWN") > "$SNAP/06_docker/docker_version.txt"
(docker compose version 2>&1 || docker-compose version 2>&1 || echo "compose: UNKNOWN") > "$SNAP/06_docker/compose_version.txt"
# compose config/ps
(cd "$REPO" && (docker compose config 2>&1 || docker-compose config 2>&1 || echo "compose config: UNKNOWN")) > "$SNAP/06_docker/compose_config.yaml"
(cd "$REPO" && (docker compose ps --all 2>&1 || docker-compose ps --all 2>&1 || echo "compose ps: UNKNOWN")) > "$SNAP/06_docker/compose_ps.txt"
(docker images --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}' 2>/dev/null || echo "docker images: UNKNOWN") > "$SNAP/06_docker/images.txt"
(ss -tulpn 2>/dev/null | grep LISTEN || echo "ss: UNKNOWN") > "$SNAP/06_docker/listen_ports.txt"

# Раздел 7: Container inspect (env keys only)
mkdir -p "$SNAP/07_container_inspect" 2>/dev/null || true
if _have docker; then
  docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null \
    | grep -Ei 'web|app|frontend|db|postgres|proxy|caddy|nginx' 2>/dev/null \
    | while read -r NAME IMG; do
        {
          echo "name=$NAME image=$IMG"
          docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$NAME" 2>/dev/null \
            | awk -F= '{print $1"=***"}' | sort -u
        } > "$SNAP/07_container_inspect/${NAME}.env_keys.txt"
      done
fi

# Раздел 8: Next.js/SSR
mkdir -p "$SNAP/08_next_ssr" 2>/dev/null || true
if [ -d "$REPO/.next" ]; then
  (du -sh "$REPO/.next" 2>/dev/null || true) > "$SNAP/08_next_ssr/dot_next_size.txt"
  (find "$REPO/.next" -maxdepth 2 -name 'app-paths-manifest.json' -o -name 'routes-manifest.json' -o -name 'BUILD_ID' 2>/dev/null) \
    > "$SNAP/08_next_ssr/manifests.txt"
else
  echo "UNKNOWN (.next not found)" > "$SNAP/08_next_ssr/README.txt"
fi
# маршруты (app/ и pages/)
(find "$REPO/app" -type f \( -name 'page.*' -o -name 'route.*' \) 2>/dev/null || true) > "$SNAP/08_next_ssr/app_routes_files.txt"
(find "$REPO/pages" -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.jsx' -o -name '*.js' \) 2>/dev/null || true) > "$SNAP/08_next_ssr/pages_files.txt"

# Раздел 9: HTTP публичные проверки (если задан --host)
mkdir -p "$SNAP/09_http_head" 2>/dev/null || true
if [ -n "$HOST" ] && _have curl; then
  for p in "/" "/robots.txt" "/sitemap.xml" "/sitemaps/vin.xml"; do
    curl -sSI "${HOST}${p}" \
      | egrep -i '^(HTTP/|content-type:|cache-control:|strict-transport-security:|content-security-policy:|referrer-policy:|x-content-type-options:|x-frame-options:)' \
      > "$SNAP/09_http_head$(echo "$p" | sed 's#/##g; s#^$#root#').txt"
  done
fi

# Раздел 10: SEO/статик
mkdir -p "$SNAP/10_seo_static" 2>/dev/null || true
if [ -d "$REPO/public" ]; then
  (cd "$REPO" && find public -type f 2>/dev/null | head -n 300) > "$SNAP/10_seo_static/public_inventory.txt"
  for f in robots.txt sitemap.xml manifest.json; do
    [ -f "$REPO/public/$f" ] && echo "present: public/$f" || echo "absent: public/$f"
  done > "$SNAP/10_seo_static/presence.txt"
  (grep -R --line-number 'application/ld+json' "$REPO/public" 2>/dev/null || true) > "$SNAP/10_seo_static/ldjson_grep.txt"
else
  echo "UNKNOWN (no public/)" > "$SNAP/10_seo_static/README.txt"
fi

# Раздел 11: База данных (Postgres)
mkdir -p "$SNAP/11_db" 2>/dev/null || true
if _have psql; then
  # пробуем без интерактива; если нет PG* переменных — отметим UNKNOWN
  if [ -n "${PGHOSTADDR:-}${PGHOST:-}${PGDATABASE:-}${PGUSER:-}" ]; then
    psql -X -v ON_ERROR_STOP=0 -c "\conninfo" 2>&1 > "$SNAP/11_db/conninfo.txt"
    psql -X -v ON_ERROR_STOP=0 -At -c "select nspname from pg_namespace order by 1;" 2>&1 > "$SNAP/11_db/schemas.txt"
    psql -X -v ON_ERROR_STOP=0 -At -c "select schemaname,tablename from pg_tables order by 1,2 limit 500;" 2>&1 > "$SNAP/11_db/tables.txt"
    psql -X -v ON_ERROR_STOP=0 -At -c "select n.nspname,c.relname,pg_total_relation_size(c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' order by 3 desc limit 50;" 2>&1 > "$SNAP/11_db/top_sizes.tsv"
    psql -X -v ON_ERROR_STOP=0 -At -c "select coalesce(state,'unknown') as state, count(*) from pg_stat_activity group by 1 order by 2 desc;" 2>&1 > "$SNAP/11_db/pg_stat_activity.txt"
  else
    echo "UNKNOWN (no PG* env for psql). HowTo: export PGHOST/PGUSER/PGDATABASE/PGSSLMODE=verify-full PGSSLROOTCERT=/etc/vinops/pg/ca.crt" > "$SNAP/11_db/README-UNKNOWN.txt"
  fi
else
  echo "UNKNOWN (psql not installed)" > "$SNAP/11_db/README-UNKNOWN.txt"
fi

# Раздел 12: Reverse proxy / TLS
mkdir -p "$SNAP/12_proxy_tls" 2>/dev/null || true
(ls -l /etc/nginx 2>/dev/null; ls -l /etc/nginx/sites-enabled 2>/dev/null) > "$SNAP/12_proxy_tls/nginx_ls.txt"
(grep -R -nE 'server_name|listen|ssl_|proxy_pass' /etc/nginx 2>/dev/null | head -n 500) > "$SNAP/12_proxy_tls/nginx_grep.txt"
(ls -l /etc/caddy 2>/dev/null; ls -l /etc/caddy/Caddyfile 2>/dev/null) > "$SNAP/12_proxy_tls/caddy_ls.txt"
(grep -nE 'tls|reverse_proxy|encode|header' /etc/caddy/Caddyfile 2>/dev/null || true) > "$SNAP/12_proxy_tls/caddy_grep.txt"
if [ -n "$HOST" ] && _have openssl; then
  (echo | openssl s_client -servername "$(echo "$HOST" | sed -E 's#https?://##; s#/.*$##')" -connect "$(echo "$HOST" | sed -E 's#https?://##; s#/.*$##'):443" 2>/dev/null \
    | openssl x509 -noout -subject -issuer -enddate 2>/dev/null) > "$SNAP/12_proxy_tls/cert_info.txt"
fi

# Раздел 13: Jobs/CRON/systemd
{
  (crontab -l 2>/dev/null || echo "no crontab")
  echo "---- systemd services (filtered) ----"
  (systemctl list-units --type=service --no-pager 2>/dev/null | grep -E 'cron|timer|node|docker|nginx|caddy' || true)
  echo "---- systemd timers ----"
  (systemctl list-timers --no-pager 2>/dev/null | grep -E 'timer' || true)
} > "$SNAP/13_jobs_systemd.txt" 2>/dev/null || true
(find "$REPO/scripts" -maxdepth 3 -type f 2>/dev/null || true) > "$SNAP/13_jobs_scripts_inventory.txt"

# Раздел 14: Логи (tail)
mkdir -p "$SNAP/14_logs" 2>/dev/null || true
(cd "$REPO" && (docker compose logs --tail "$LOGS" web 2>&1 || docker-compose logs --tail "$LOGS" web 2>&1 || echo "no web logs")) > "$SNAP/14_logs/web.txt"
(cd "$REPO" && (docker compose logs --tail "$LOGS" db  2>&1 || docker-compose logs --tail "$LOGS" db  2>&1 || echo "no db logs")) > "$SNAP/14_logs/db.txt"
(cd "$REPO" && (docker compose logs --tail "$LOGS" proxy 2>&1 || docker-compose logs --tail "$LOGS" proxy 2>&1 || echo "no proxy logs")) > "$SNAP/14_logs/proxy.txt"

# Раздел 15: Конфиги и окружение
mkdir -p "$SNAP/15_configs" 2>/dev/null || true
(cp -f "$REPO"/docker-compose*.yml "$SNAP/15_configs/" 2>/dev/null || true)
(cp -f "$REPO"/Dockerfile* "$SNAP/15_configs/" 2>/dev/null || true)
(cp -f "$REPO"/next.config.* "$SNAP/15_configs/" 2>/dev/null || true)
(cp -f "$REPO"/tsconfig* "$SNAP/15_configs/" 2>/dev/null || true)
# env samples + маски
for f in "$REPO/.env" "$REPO/.env.local" "$REPO/.env.production" "$REPO/env.sample" "$REPO/.env.example"; do
  if [ -f "$f" ]; then
    base="$(basename "$f")"
    _mask_envfile < "$f" > "$SNAP/15_configs/${base}.keys_masked.txt"
  fi
done

# Раздел 16: Сводка UNKNOWN/рисков
{
  echo "# UNKNOWN (если присутствуют)"
  [ -f "$SNAP/08_next_ssr/README.txt" ] && echo "Next.js build artifacts: UNKNOWN. Как проверить: выполнить сборку и убедиться в наличии .next/"
  [ -f "$SNAP/11_db/README-UNKNOWN.txt" ] && echo "DB snapshot: UNKNOWN. Как проверить: экспортировать PGHOST/PGUSER/PGDATABASE и повторить."
  if [ -z "$HOST" ]; then
    echo "HTTP HEADs: UNKNOWN (host not provided). Как проверить: запустить с --host https://example.org"
  fi

  echo
  echo "# Риски/наблюдения (эвристика)"
  [ ! -d "$REPO/public" ] && echo "- Нет каталога public/ — часть SEO/статик может отсутствовать."
  ! _have docker && echo "- Docker не установлен/недоступен."
  ! _have node   && echo "- Node.js не установлен/недоступен."
} > "$SNAP/16_summary.txt" 2>/dev/null || true

# Упаковка
mkdir -p "$OUT/context" 2>/dev/null || true
( cd "$OUT/context" && tar -czf "context-$STAMP-Europe_Warsaw.tar.gz" "context-$STAMP" ) 2>/dev/null || true

# Абсолютный путь к архиву
if [ -f "$ARCH" ]; then
  _log "Snapshot archived: $ARCH"
else
  # если tar положил рядом (на некоторых системах tar не создаёт через абс. путь)
  ALT="$OUT/context/context-$STAMP-Europe_Warsaw.tar.gz"
  if [ -f "$ALT" ]; then
    ARCH="$ALT"
    _log "Snapshot archived: $ARCH"
  else
    _warn "Archive not found; check $OUT/context/"
  fi
fi

# Всегда код 0
exit 0
