Диагностический снимок проекта (read-only)
Создан: 2025-09-19T20:35:42+02:00 (Europe/Warsaw)
Репозиторий: /root/work/vinops.restore

Содержимое:
  system/   — ОС/CPU/RAM/Disk/Time
  git/      — ветка, последние коммиты, статус, теги, remotes
  node/     — версии node/npm/pnpm/yarn/npx/next (host+container если доступно)
  repo/     — layout ключевых каталогов, участие в сборке
  docker/   — compose config/ps/ports/images/inspect (с маскированием), логи
  next/     — артефакты .next (host+container), список маршрутов по файловой схеме
  http/     — curl заголовки/коды для /, /en, /ru, /robots.txt, /sitemap.xml, /health
  seo/      — robots.txt/sitemap.xml/hreflang/canonical/json-ld (если найдены)
  db/       — conninfo, список таблиц и размеры (если доступен Postgres контейнер)
  sched/    — крон/таймеры (host+containers)
  config/   — docker-compose*.yml, Dockerfile*, .env* (значения маскированы)
