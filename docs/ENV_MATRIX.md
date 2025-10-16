# ENV_MATRIX — Vinops (EU/NL)
(Europe/Warsaw) Последнее обновление: 2025-10-16 07:58:20 CEST

| KEY | Назначение | Где используется | Источник/файл | Где задано | Статус значения |
|---|---|---|---|---|---|
| DATABASE_URL | Строка подключения для backend/web | код (`frontend/src/app/api/_lib/db.ts`) | deploy/.env.runtime, compose override | prod env (container) | PRESENT/UNKNOWN |
| POSTGRES_DSN | Альтернативный DSN (утилиты) | scripts/tools | deploy/.env.runtime | prod env | PRESENT/UNKNOWN |
| DB_NAME | Имя БД для compose db | docker-compose.yml | .env (compose) | prod compose env | UNKNOWN |
| DB_USER | Пользователь БД | docker-compose.yml | .env (compose) | prod compose env | UNKNOWN |
| DB_PASSWORD | Пароль БД | docker-compose.yml | .env (compose) | prod compose env | UNKNOWN |
| DB_PORT | Порт БД | docker-compose.yml | .env (compose, default 5432) | prod compose env | DEFAULT/5432 |
| DOMAIN_OR_IP | Хост для NEXT_PUBLIC_API_URL | docker-compose.yml:web | .env (compose) | prod compose env | UNKNOWN |
| PORT_API_HOST | Хост-порт API (проксируется) | docker-compose.yml:api | .env (compose) | prod compose env | UNKNOWN |
| PORT_WEB_HOST | Хост-порт web (проксируется) | docker-compose.yml:web | .env (compose) | prod compose env | DEFAULT/80 |
| GHCR_IMAGE_API | Образ API (если тянем с GHCR) | docker-compose.yml:api | .env (compose) | prod compose env | OPTIONAL |
| API_IMAGE_TAG | Тег образа API | docker-compose.yml:api | .env (compose) | prod compose env | OPTIONAL |
| GHCR_IMAGE_WEB | Образ web (если тянем с GHCR) | docker-compose.yml:web | .env (compose) | prod compose env | OPTIONAL |
| WEB_IMAGE_TAG | Тег образа web | docker-compose.yml:web | .env (compose) | prod compose env | OPTIONAL |
| NEXT_PUBLIC_API_URL | URL API для фронта | docker-compose.yml:web | формируется из DOMAIN_OR_IP:PORT_API_HOST | prod compose env | DERIVED |
| NEXT_PUBLIC_SITE_URL | Базовый URL сайта | frontend/src/lib/site.ts | build args / env | prod env | UNKNOWN |
| NEXT_PUBLIC_API_BASE | Базовый префикс API | frontend/src/lib/api-vin.ts | env | prod env | UNKNOWN |
| SENTRY_DSN | DSN Sentry | docker-compose.yml | секрет | prod env | UNKNOWN |
| NEXT_PUBLIC_SENTRY_DSN | DSN Sentry (public) | docker-compose.yml | секрет | prod env | UNKNOWN |
| NEXT_TELEMETRY_DISABLED | Откл. телеметрии Next | Dockerfile/env | deploy/.env.runtime | prod env | 1 |

> Значения не публикуются в репозитории. Проверка наличия выполняется в рантайме контейнеров.
