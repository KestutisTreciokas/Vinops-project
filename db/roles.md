# Роли БД и привилегии (vinops)
Зона времени: Europe/Warsaw

## Роли
- app_ro: SELECT на core.* (каталог/карточка), CONNECT к БД.
- etl_rw: SELECT, INSERT, UPDATE на core.*; ALL на stg.*; DELETE/TRUNCATE запрещены в core.
- db_admin: владелец схем vinops/core/stg, выполняет миграции.

## Дефолт-привилегии
- core.*: GRANT SELECT TO app_ro; GRANT SELECT,INSERT,UPDATE TO etl_rw (ALTER DEFAULT PRIVILEGES ...)
- stg.*: GRANT ALL TO etl_rw
