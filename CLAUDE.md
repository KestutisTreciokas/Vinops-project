# Vinops Project Guide

## Tech Stack

**Frontend:**
- Next.js 14.2.5
- React 18.3.1
- TypeScript 5.6.2
- Tailwind CSS 3.4.10

**Backend:**
- Node.js >=20.14 <21
- PostgreSQL 17.6 (pg 8.x client)

**Database:**
- PostgreSQL 17.6
- SQL migrations (db/migrations/)

**Infrastructure:**
- Docker & Docker Compose
- GitHub Actions (CI/CD)
- Caddy (reverse proxy)

## Project Structure

- **frontend/** — Next.js приложение с TypeScript и Tailwind
- **backend/** — Placeholder для бэкенд-сервиса (пока содержит Dockerfile)
- **db/** — SQL-схемы, миграции и скрипты настройки ролей
- **scripts/** — Утилиты для тестирования подключения к БД и smoke-тесты
- **docs/** — Техническая документация (архитектура, CI/CD, runbooks)
- **contracts/** — API-контракты и доменные модели
- **deploy/** — Скрипты развёртывания
- **security/** — Настройки безопасности (TLS, observability)
- **.github/** — GitHub Actions workflows
- **docker-compose.yml** — Оркестрация сервисов (db, api, web)

## Commands

**Frontend (из папки frontend/):**
```bash
npm run dev        # – запустить локальный сервер разработки
npm run build      # – собрать production-билд
npm run lint       # – запустить линтер
npm run typecheck  # – прогнать проверку типов TypeScript
```

**Root:**
```bash
# Нет npm-скриптов в корне; используйте Docker Compose или скрипты:
docker-compose up              # – запустить все сервисы (db, api, web)
./scripts/verify-db.sh         # – проверить подключение к БД
./scripts/test-db-connection.js  # – прогнать тесты подключения к БД
./scripts/smoke.sh             # – запустить smoke-тесты
```

## Code Style

**Workflow for significant code changes:**

1. **Local testing** — run tests, lint, typecheck
2. **Commit & Push** — if tests pass: `git commit` and `git push`
3. **GitHub Actions** — automatic CI/CD run
4. **Merge PR** — PRs are merged manually by the requester

## GitHub

**Repository:** https://github.com/KestutisTreciokas/Vinops-project

### GitHub CLI Authentication

**Status:** Authenticated as `KestutisTreciokas` via `gh auth login`

**For automated PR creation:**
- Token stored securely in `gh auth login` session
- Alternative: Set `GH_TOKEN` environment variable with fine-grained PAT
- Token location: Stored outside repository (see secrets management docs)

**Usage:**
```bash
gh pr create --title "..." --body "..." --base main
```

---

## REPORT — Copart CSV Access (diagnostic) — 2025-10-15

- **Generated:** 2025-10-15 08:57 Europe/Warsaw
- **Timestamp:** 2025-10-15 08:36
- **Scope:** MS-CSV-01…05 consolidated

### Executive Summary

- **How the CSV is downloaded:** via the **Download Sales Data** button after logging in as a Member; final direct URL: `https://inventory.copart.io/FTPLSTDM/salesdata.cgi?authKey=YPYU91EI`.
- **Authorization:** **cookie after interactive login**; CSV 200 at 2025-10-15T06:07:23.908Z.
- **User-Agent/Referer:** FIXED UA — Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36; REQUIRED — observed on the CSV request.
- **URL nature:** tokenized (query param `authKey=…`); TTL: not set in MS-CSV-01 (checked in MS-CSV-02).
- **Update frequency:** **~15 minutes** (CSV_DIFF: updated=YES, Last-Modified=Wed, 15 Oct 2025 03:45:03 GMT).
- **Readiness status:** **diagnostic-only** (no production automation).

### Source and URL Mechanics

- **Final URL:** `https://inventory.copart.io/FTPLSTDM/salesdata.cgi?authKey=YPYU91EI`
- **URL classification:** tokenized (query param `authKey=…`)
- **TTL/one-time use:** not set in MS-CSV-01 (checked in MS-CSV-02)
- **CSV response headers** (from CSV_HEADERS.md):
  `Content-Type=application/octet-stream`, `Content-Length=95989841`,
  `Content-Disposition=attachment; filename="salesdata.csv"`,
  `Last-Modified=Wed, 15 Oct 2025 03:45:03 GMT`,
  `Cache-Control=` **absent**,
  `ETag="68ef18bf-5b8b051"`
- **Links:** `CSV_HAR_1.har`, `CSV_URLS.txt`, `CSV_HEADERS.md`

**Source URL:** `https://inventory.copart.io/FTPLSTDM/salesdata.cgi?authKey=YPYU91EI`
**URL classification:** tokenized (query param)
**URL TTL:** UNKNOWN — **How to verify:** repeat a GET for the same URL after ≥20 minutes; record status code and headers. If 200 and `Last-Modified` changes → URL is reusable; if 403/redirect → one-time/TTL-limited.

### Authorization

- **Method:** cookie after interactive Member login; CSV 200 at 2025-10-15T06:07:23.908Z.
- **Authorization:** COOKIE (Member login)
- **UA requirement:** FIXED UA — Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36
- **Requirements:** FIXED UA — Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36; Referer: REQUIRED — observed on CSV request; CSRF: Login=PRESENT, CSV=NOT USED
- **Links:** `AUTH_FLOW.md`, `UA_REQUIREMENTS.md`

### Update Frequency and URL Evolution

**Frequency:** ~15 min (observed)

- **Intervals and update evidence:** `updated=YES` per `CSV_DIFF.md`.
- **URL behavior:** SAME
  - run1 = `https://inventory.copart.io/FTPLSTDM/salesdata.cgi?authKey=YPYU91EI` @ 2025-10-15T04:04:20.997Z
  - run2 = `https://inventory.copart.io/FTPLSTDM/salesdata.cgi?authKey=YPYU91EI` @ 2025-10-15T04:27:20.510Z
  - window ≈ 1380s
- **Observed update:** YES
- **Frequency:** UNKNOWN — **How to verify:** perform 4–6 downloads every 15 minutes and confirm consistent updates.
- **Links:** `run1.csv`, `run2.csv`, `CSV_DIFF.md`, `CSV_URL_EVOLUTION.md`

### Data Volume / Composition

- **Columns:** 59 (see `CSV_SCHEMA.md`)
- **Category coverage:** ALL; Export filters: NONE
- **Lot validation:** see the **Verification** section in `CSV_VOLUME.md` (result: OK=3, MIXED=0, FAIL=0)
- **Links:** `CSV_SCHEMA.md`, `CSV_VOLUME.md`

**Columns:** 59
**Categories coverage:** ALL
**Filters in export:** NONE

### Regional Restrictions

- **Matrix:** see `REGION_ACCESS.md`
- **Summary:** CSV verdict — NOT NEEDED (RU-direct `csvurl` = 200); Site verdict — NEEDED (RU-direct forbidden; proxy allows access)

### Compliance / Licensing

- We use only the official **Download Sales Data CSV** mechanism after login; no scraping/crawling.
- **Decision Log:** **DL-009 — Copart CSV access (diagnostic-only, compliant flow)** — referenced in the report; policy may change and requires periodic revalidation.

### Risks and Limitations

- Anti-bot/Imperva: possible blocks/captcha, rate-limiting.
- Session/cookie expirations; UA/Referer requirements.
- No public API/SLAs; URL relies on an `authKey` parameter.

### Recommendation (Go/No-Go) and Working Procedure

- **Recommendation:** Go (diagnostic-only). For production integration — legal ToS review, anti-bot strategy, and a stable session renewal regimen are required.
- **Diagnostic runbook (manual):**
  1. Log in as a Member in a browser (EU/US egress if needed).
  2. Go to `https://www.copart.com/downloadSalesData` and click **Download CSV file**.
  3. Capture a HAR and the final URL; download the CSV; record the 200 headers.
  4. After ≥20 minutes, repeat steps 2–3; compare for updates (`CSV_DIFF.md`).
