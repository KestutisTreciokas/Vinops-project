-- bootstrap_roles.sql — создать роли и выдать привилегии (идемпотентно)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_ro') THEN
    CREATE ROLE app_ro LOGIN PASSWORD NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'etl_rw') THEN
    CREATE ROLE etl_rw LOGIN PASSWORD NULL;
  END IF;
END$$;

-- Схемы для поэтапной миграции (если будут использоваться)
CREATE SCHEMA IF NOT EXISTS core AUTHORIZATION CURRENT_USER;
CREATE SCHEMA IF NOT EXISTS stg  AUTHORIZATION CURRENT_USER;

-- Дефолт-привилегии для будущих объектов в core/stg
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT ON TABLES TO app_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT,INSERT,UPDATE ON TABLES TO etl_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA stg  GRANT ALL    ON TABLES TO etl_rw;

-- Права на существующие и будущие объекты в PUBLIC (текущая схема таблиц)
GRANT USAGE ON SCHEMA public TO app_ro, etl_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_ro;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO etl_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT               ON TABLES TO app_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE ON TABLES TO etl_rw;

-- Права на core/stg (если появятся там таблицы)
GRANT USAGE ON SCHEMA core, stg TO app_ro, etl_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA core TO app_ro;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA core TO etl_rw;
GRANT ALL ON ALL TABLES IN SCHEMA stg TO etl_rw;

-- Базовый CONNECT
GRANT CONNECT ON DATABASE vinops TO app_ro, etl_rw;
