-- setup_roles_and_privs.sql — S-03
-- Групповые роли (NOLOGIN) + включение их в рабочую учётку gen_user
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_ro') THEN
    CREATE ROLE app_ro NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='etl_rw') THEN
    CREATE ROLE etl_rw NOLOGIN;
  END IF;
  -- Привязка к рабочей учётке (если есть)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='gen_user') THEN
    GRANT app_ro TO gen_user;
    GRANT etl_rw TO gen_user;
  END IF;
END$$;

-- Привилегии на схему public (где живут таблицы v1)
GRANT USAGE ON SCHEMA public TO app_ro, etl_rw;

-- Права на существующие объекты
GRANT SELECT ON ALL TABLES    IN SCHEMA public TO app_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO app_ro;

GRANT SELECT,INSERT,UPDATE ON ALL TABLES    IN SCHEMA public TO etl_rw;
GRANT USAGE,SELECT,UPDATE    ON ALL SEQUENCES IN SCHEMA public TO etl_rw;

-- Дефолт-права для будущих объектов в public
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES    TO app_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO app_ro;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE ON TABLES TO etl_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT,UPDATE  ON SEQUENCES TO etl_rw;
