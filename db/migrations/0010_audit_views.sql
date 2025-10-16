-- 0010_audit_views.sql — Observability metric views
-- Sprint: S1 — ETL A (CSV→PG)
-- Dependencies: 0009_lots_external_id.sql

-- Ingest count per file
CREATE OR REPLACE VIEW audit.v_ingest_count AS
SELECT
  f.file_id,
  f.path,
  f.window_start_utc,
  f.row_count as declared_rows,
  COUNT(r.id) as actual_rows,
  f.ingested_at
FROM raw.csv_files f
LEFT JOIN raw.rows r ON f.file_id = r.file_id
GROUP BY f.file_id, f.path, f.window_start_utc, f.row_count, f.ingested_at;

-- Unknown rate (NULL/empty columns)
CREATE OR REPLACE VIEW audit.v_unknown_rate AS
SELECT
  file_id,
  COUNT(*) FILTER (WHERE payload_jsonb->>'VIN' IS NULL OR payload_jsonb->>'VIN' = '') * 100.0 / NULLIF(COUNT(*), 0) as vin_null_pct,
  COUNT(*) FILTER (WHERE payload_jsonb->>'Lot number' IS NULL OR payload_jsonb->>'Lot number' = '') * 100.0 / NULLIF(COUNT(*), 0) as lot_null_pct,
  COUNT(*) as total_rows
FROM raw.rows
GROUP BY file_id;

-- Parse errors (malformed rows logged in staging)
CREATE OR REPLACE VIEW audit.v_parse_errors AS
SELECT
  file_id,
  COUNT(*) as error_count,
  array_agg(DISTINCT processing_error) as error_types
FROM staging.copart_raw
WHERE processing_error IS NOT NULL
GROUP BY file_id;

COMMENT ON VIEW audit.v_ingest_count IS 'Rows ingested per CSV file';
COMMENT ON VIEW audit.v_unknown_rate IS 'Percentage of NULL/empty key columns';
COMMENT ON VIEW audit.v_parse_errors IS 'Parsing errors per file';

-- Rollback:
-- DROP VIEW IF EXISTS audit.v_ingest_count, audit.v_unknown_rate, audit.v_parse_errors;
