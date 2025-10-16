# ARCHITECTURE

## Data Access (DAL) — v1 (MS-02-02)
- Runtime: Next.js (Node runtime), pg Pool.
- Connection: `DATABASE_URL` (role `app_ro`). TLS defaults to **verify-full**; `PGSSLMODE=disable/allow/prefer` is rejected in production.
- Session defaults on connect:
  - `SET TIME ZONE 'UTC'`
  - `SET application_name = 'vinops.frontend'`
  - `SET default_transaction_read_only = on`
  - `SET statement_timeout = 2000` ms
  - `SET lock_timeout = 1000` ms
  - `SET idle_in_transaction_session_timeout = 5000` ms
- Read-only guard in code: only `SELECT`/`WITH` allowed, others rejected before send.
- Prepared statements: automatic names `v1_<sha1>`; pass `opts.name` to override.
- Per-query timeout: `opts.timeoutMs` uses `SET LOCAL statement_timeout` inside a short transaction.
- Retries: one retry on transient errors (deadlock/timeouts/reset).
- Correlation: JSON logs include `traceId`, `requestId`, `durMs`, `rowCount`.
- N+1: prefer CTE/aggregations; helper `anyArray()` for `ANY($1)` patterns.

## Env
- `DATABASE_URL`: libpq-style DSN.
- `PGSSLMODE`: `verify-full` (default) | `verify-ca` | `require|prefer|allow|disable` (non-prod only).

