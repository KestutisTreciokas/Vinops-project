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

## GitHub

**Repository:** https://github.com/KestutisTreciokas/Vinops-project
