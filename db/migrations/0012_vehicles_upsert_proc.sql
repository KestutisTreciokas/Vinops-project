-- Migration 0012: Vehicles Upsert Procedure
-- Sprint: S1B ETL — Core Upsert (Vehicles)
-- Purpose: Batch upsert from staging.copart_raw to public.vehicles
-- Date: 2025-10-16

-- Add columns to vehicles table for CSV data
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS trim TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS odometer_value INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS odometer_unit TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS odometer_brand TEXT;

-- Create stored procedure for batch vehicle upsert
CREATE OR REPLACE FUNCTION upsert_vehicles_batch(staging_file_id UUID)
RETURNS TABLE(
  inserted_count INT,
  updated_count INT,
  skipped_count INT
) AS $$
DECLARE
  v_inserted INT := 0;
  v_updated INT := 0;
  v_skipped INT := 0;
BEGIN
  -- Upsert vehicles from staging
  WITH upsert_result AS (
    INSERT INTO vehicles (
      vin,
      vin_raw,
      year,
      make,
      model,
      trim,
      body,
      fuel,
      transmission,
      drive,
      engine,
      color,
      odometer_value,
      odometer_unit,
      odometer_brand,
      updated_at
    )
    SELECT DISTINCT ON (normalize_vin(vin_raw))
      normalize_vin(vin_raw) AS vin,
      vin_raw,
      NULLIF(payload_jsonb->>'Year', '')::INTEGER,
      UPPER(NULLIF(payload_jsonb->>'Make', '')),
      UPPER(NULLIF(payload_jsonb->>'Model Group', '')),
      NULLIF(payload_jsonb->>'Trim', ''),
      NULLIF(payload_jsonb->>'Body Style', ''),
      NULLIF(payload_jsonb->>'Fuel Type', ''),
      NULLIF(payload_jsonb->>'Transmission', ''),
      NULLIF(payload_jsonb->>'Drive', ''),
      NULLIF(payload_jsonb->>'Engine', ''),
      NULLIF(payload_jsonb->>'Color', ''),
      NULLIF(payload_jsonb->>'Odometer', '')::NUMERIC::INTEGER,
      CASE
        WHEN NULLIF(payload_jsonb->>'Odometer', '') IS NOT NULL THEN 'mi'
        ELSE NULL
      END,
      NULLIF(payload_jsonb->>'Odometer Brand', ''),
      now()
    FROM staging.copart_raw
    WHERE file_id = staging_file_id
      AND vin_raw IS NOT NULL
      AND vin_raw != ''
      AND normalize_vin(vin_raw) IS NOT NULL
      AND normalize_vin(vin_raw) ~ '^[A-HJ-NPR-Z0-9]{11,17}$'
    ORDER BY normalize_vin(vin_raw), window_start_utc DESC
    ON CONFLICT (vin)
    DO UPDATE SET
      vin_raw = COALESCE(EXCLUDED.vin_raw, vehicles.vin_raw),
      year = COALESCE(EXCLUDED.year, vehicles.year),
      make = COALESCE(EXCLUDED.make, vehicles.make),
      model = COALESCE(EXCLUDED.model, vehicles.model),
      trim = COALESCE(EXCLUDED.trim, vehicles.trim),
      body = COALESCE(EXCLUDED.body, vehicles.body),
      fuel = COALESCE(EXCLUDED.fuel, vehicles.fuel),
      transmission = COALESCE(EXCLUDED.transmission, vehicles.transmission),
      drive = COALESCE(EXCLUDED.drive, vehicles.drive),
      engine = COALESCE(EXCLUDED.engine, vehicles.engine),
      color = COALESCE(EXCLUDED.color, vehicles.color),
      odometer_value = COALESCE(EXCLUDED.odometer_value, vehicles.odometer_value),
      odometer_unit = COALESCE(EXCLUDED.odometer_unit, vehicles.odometer_unit),
      odometer_brand = COALESCE(EXCLUDED.odometer_brand, vehicles.odometer_brand),
      updated_at = now()
    WHERE vehicles.updated_at < EXCLUDED.updated_at
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    COUNT(*) FILTER (WHERE inserted),
    COUNT(*) FILTER (WHERE NOT inserted)
  INTO v_inserted, v_updated
  FROM upsert_result;

  -- Count skipped (NULL or invalid VINs)
  SELECT COUNT(*) INTO v_skipped
  FROM staging.copart_raw
  WHERE file_id = staging_file_id
    AND (
      vin_raw IS NULL
      OR vin_raw = ''
      OR normalize_vin(vin_raw) IS NULL
      OR normalize_vin(vin_raw) !~ '^[A-HJ-NPR-Z0-9]{11,17}$'
    );

  -- Log to audit (use existing table structure)
  INSERT INTO audit.etl_runs (
    file_id,
    status,
    rows_processed,
    rows_inserted,
    rows_updated,
    rows_skipped,
    started_at,
    completed_at
  ) VALUES (
    staging_file_id,
    'completed',
    v_inserted + v_updated + v_skipped,
    v_inserted,
    v_updated,
    v_skipped,
    now(),
    now()
  );

  RETURN QUERY SELECT v_inserted, v_updated, v_skipped;
END;
$$ LANGUAGE plpgsql;

-- audit.etl_runs already exists, no need to create

-- Create audit table for vehicle conflicts
CREATE TABLE IF NOT EXISTS audit.vehicle_conflicts (
  id BIGSERIAL PRIMARY KEY,
  vin TEXT NOT NULL,
  file_id UUID NOT NULL,
  conflict_type TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  resolved_value JSONB,
  detected_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vehicle_conflicts_vin ON audit.vehicle_conflicts(vin);
CREATE INDEX idx_vehicle_conflicts_detected_at ON audit.vehicle_conflicts(detected_at DESC);

-- Grant permissions
GRANT EXECUTE ON FUNCTION upsert_vehicles_batch(UUID) TO gen_user;
GRANT INSERT, SELECT ON audit.vehicle_conflicts TO gen_user;
GRANT USAGE, SELECT ON SEQUENCE audit.vehicle_conflicts_id_seq TO gen_user;

-- Update INDEX.md registry
COMMENT ON FUNCTION upsert_vehicles_batch(UUID) IS 'Migration 0012: Batch upsert vehicles from staging with conflict tracking';
