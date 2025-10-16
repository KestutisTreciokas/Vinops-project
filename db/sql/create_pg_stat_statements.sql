-- Idempotent installer for pg_stat_statements (run once provider enables preload)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
