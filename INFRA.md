# INFRA — Health Policy (Europe/Warsaw)

## Единая политика health (MS-01-04, зафиксировано)
- **Web (Next.js)**: HTTP `GET /health` — единственный источник истины для healthcheck’ов контейнера `web`.
- **Алиасы** `/en/health`, `/ru/health` не используются в healthcheck’ах (допустимы только как публичные маршруты).
- **Compose overlays**:
  - `docker-compose.health.yml` — включает healthcheck `web` на `/health`.
  - `docker-compose.hostfix.yml` — исторический overlay; приведён к `/health`.
- **Prod compose**: `docker-compose.prod.yml` **без** ключа `version:` (устаревший), health добавляется overlay’ем.
- **DB**: проверка БД (если используется отдельный сервис) — средством БД (`pg_isready`), не HTTP.

## Проверка (смоук)
```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml -f docker-compose.health.yml config
grep -RIn '/api/v1/health' *.yml
grep -RIn '/health' *.yml


## Health policy (S1/MS-01-04)
- Единственный допустимый HTTP health endpoint: `/health` (локализованные алиасы не используются в checks).
- В `docker-compose*.yml` healthcheck обязан иметь вид:
  ```yaml
  healthcheck:
    test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:3000/health || exit 1"]
  ```
