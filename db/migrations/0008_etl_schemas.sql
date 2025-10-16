-- 0008_etl_schemas.sql — ETL Pipeline Schemas (raw, staging, audit)
-- Sprint: S1 — ETL A (CSV→PG)
-- Dependencies: 0007_canon_domains_columns.sql
-- Rollback: DROP SCHEMA IF EXISTS raw CASCADE; DROP SCHEMA IF EXISTS staging CASCADE; DROP SCHEMA IF EXISTS audit CASCADE;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- ============================================================
-- RAW SCHEMA: Immutable CSV storage (lossless JSONB)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS raw;
COMMENT ON SCHEMA raw IS 'Immutable CSV files and rows (JSONB payload); permanent retention';

-- CSV files metadata
CREATE TABLE IF NOT EXISTS raw.csv_files (
  file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,                    -- /var/data/vinops/raw/copart/YYYY/MM/DD/HHmm.csv
  sha256 TEXT NOT NULL UNIQUE,           -- file integrity check
  bytes BIGINT NOT NULL CHECK (bytes > 0),
  row_count INT CHECK (row_count >= 0),  -- total rows (excluding header)
  headers_jsonb JSONB NOT NULL,          -- column names (schema evolution tracking)
  window_start_utc TIMESTAMPTZ,          -- extracted from filename or CSV metadata
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT path_format_ck CHECK (path ~ '^/var/data/vinops/raw/copart/\d{4}/\d{2}/\d{2}/\d{4}\.csv$')
);

CREATE INDEX IF NOT EXISTS idx_csv_files_window ON raw.csv_files(window_start_utc);
CREATE INDEX IF NOT EXISTS idx_csv_files_ingested ON raw.csv_files(ingested_at);
COMMENT ON TABLE raw.csv_files IS 'CSV file registry with sha256 integrity and schema headers';

-- CSV rows (JSONB payload)
CREATE TABLE IF NOT EXISTS raw.rows (
  id BIGSERIAL PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES raw.csv_files(file_id) ON DELETE CASCADE,
  row_no INT NOT NULL CHECK (row_no > 0), -- 1-indexed row number in CSV
  payload_jsonb JSONB NOT NULL,            -- full row as key-value pairs
  UNIQUE(file_id, row_no)
);

CREATE INDEX IF NOT EXISTS idx_rows_file ON raw.rows(file_id);
CREATE INDEX IF NOT EXISTS idx_rows_lot_number ON raw.rows((payload_jsonb->>'Lot number'));
CREATE INDEX IF NOT EXISTS idx_rows_vin ON raw.rows((payload_jsonb->>'VIN'));
COMMENT ON TABLE raw.rows IS 'CSV rows stored as JSONB (lossless); indexed by lot_number and VIN';

-- ============================================================
-- STAGING SCHEMA: Parsed CSV with extracted keys
-- ============================================================

CREATE SCHEMA IF NOT EXISTS staging;
COMMENT ON SCHEMA staging IS 'Parsed CSV data with extracted keys (lot_external_id, vin_raw); 30-day rolling retention';

-- Copart raw staging (extracted keys + JSONB)
CREATE TABLE IF NOT EXISTS staging.copart_raw (
  id BIGSERIAL PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES raw.csv_files(file_id) ON DELETE CASCADE,
  window_start_utc TIMESTAMPTZ NOT NULL,
  lot_external_id TEXT,                    -- CSV "Lot number" (upsert key)
  vin_raw TEXT,                            -- CSV "VIN" (before normalization)
  payload_jsonb JSONB NOT NULL,            -- full row (denormalized for staging)
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,                 -- timestamp when upserted to core
  processing_error TEXT,                    -- error message if upsert failed
  CONSTRAINT lot_external_id_ck CHECK (lot_external_id IS NOT NULL OR processing_error IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_staging_lot ON staging.copart_raw(lot_external_id);
CREATE INDEX IF NOT EXISTS idx_staging_vin ON staging.copart_raw(vin_raw);
CREATE INDEX IF NOT EXISTS idx_staging_window ON staging.copart_raw(window_start_utc);
CREATE INDEX IF NOT EXISTS idx_staging_processed ON staging.copart_raw(processed_at) WHERE processed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staging_errors ON staging.copart_raw(processing_error) WHERE processing_error IS NOT NULL;
COMMENT ON TABLE staging.copart_raw IS 'Staging table with extracted keys; 30-day retention; tracks processing status';

-- ============================================================
-- AUDIT SCHEMA: Observability, conflicts, ETL runs
-- ============================================================

CREATE SCHEMA IF NOT EXISTS audit;
COMMENT ON SCHEMA audit IS 'ETL observability: metrics, conflicts, run history';

-- VIN normalization conflicts
CREATE TABLE IF NOT EXISTS audit.vin_conflicts (
  id BIGSERIAL PRIMARY KEY,
  vin_raw TEXT NOT NULL,
  vin_normalized TEXT,
  lot_external_id TEXT,
  conflict_reason TEXT NOT NULL,           -- e.g., "duplicate normalized VIN", "invalid format"
  file_id UUID REFERENCES raw.csv_files(file_id),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vin_conflicts_normalized ON audit.vin_conflicts(vin_normalized);
CREATE INDEX IF NOT EXISTS idx_vin_conflicts_lot ON audit.vin_conflicts(lot_external_id);
COMMENT ON TABLE audit.vin_conflicts IS 'VIN normalization conflicts and validation failures';

-- ETL run history
CREATE TABLE IF NOT EXISTS audit.etl_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES raw.csv_files(file_id),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  rows_processed INT DEFAULT 0,
  rows_inserted INT DEFAULT 0,
  rows_updated INT DEFAULT 0,
  rows_skipped INT DEFAULT 0,
  errors_count INT DEFAULT 0,
  error_summary JSONB,                     -- array of error messages
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_seconds NUMERIC(10,2) GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (completed_at - started_at))) STORED
);

CREATE INDEX IF NOT EXISTS idx_etl_runs_file ON audit.etl_runs(file_id);
CREATE INDEX IF NOT EXISTS idx_etl_runs_status ON audit.etl_runs(status);
CREATE INDEX IF NOT EXISTS idx_etl_runs_started ON audit.etl_runs(started_at);
COMMENT ON TABLE audit.etl_runs IS 'ETL job execution history with row-level metrics';

-- Upsert conflict log
CREATE TABLE IF NOT EXISTS audit.upsert_conflicts (
  id BIGSERIAL PRIMARY KEY,
  lot_external_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL,             -- 'source_timestamp_older', 'data_mismatch', etc.
  existing_data JSONB,                     -- snapshot of existing row
  incoming_data JSONB,                     -- snapshot of incoming row
  resolution TEXT,                         -- 'kept_existing', 'updated', 'manual_review'
  file_id UUID REFERENCES raw.csv_files(file_id),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upsert_conflicts_lot ON audit.upsert_conflicts(lot_external_id);
CREATE INDEX IF NOT EXISTS idx_upsert_conflicts_type ON audit.upsert_conflicts(conflict_type);
COMMENT ON TABLE audit.upsert_conflicts IS 'Upsert conflict resolution log (last-write-wins tracking)';

-- ============================================================
-- Permissions (gen_user for S1; split roles in S2)
-- ============================================================

GRANT USAGE ON SCHEMA raw, staging, audit TO gen_user;
GRANT ALL ON ALL TABLES IN SCHEMA raw, staging, audit TO gen_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA raw, staging, audit TO gen_user;

-- Future: ALTER DEFAULT PRIVILEGES for new tables
ALTER DEFAULT PRIVILEGES IN SCHEMA raw GRANT ALL ON TABLES TO gen_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON TABLES TO gen_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT ALL ON TABLES TO gen_user;

-- Rollback: (manual execution only)
-- DROP SCHEMA IF EXISTS raw CASCADE;
-- DROP SCHEMA IF EXISTS staging CASCADE;
-- DROP SCHEMA IF EXISTS audit CASCADE;
