-- Migration 0014: VIN Validation Update
-- Sprint: S1B ETL — VIN Validation Enhancement
-- Purpose: Support legacy VINs, EU CIN, US HIN formats
-- Date: 2025-10-16

-- Create comprehensive VIN validation function
-- Supports:
-- - Standard 17-character VIN (ISO 3779)
-- - EU Craft & Industrial Number (CIN) 14+hyphen format
-- - US Hull Identification Number (HIN) 12-14 characters
-- - Legacy VIN (pre-1981) 3-17 characters

CREATE OR REPLACE FUNCTION is_valid_vin(vin_normalized TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF vin_normalized IS NULL OR TRIM(vin_normalized) = '' THEN
    RETURN FALSE;
  END IF;

  -- Comprehensive VIN validation regex
  -- Matches one of:
  -- 1. VIN 17 characters (ISO 3779)
  -- 2. EU CIN 14+hyphen format
  -- 3. US HIN 12 characters
  -- 4. Legacy VIN 3-17 characters (includes vintage cars, trailers, equipment)
  RETURN vin_normalized ~ '^(?:(?=[A-HJ-NPR-Z0-9]{17}$)[A-HJ-NPR-Z0-9]{17}|[A-Z]{2}-[A-HJ-NPR-Z2-9]{3}[A-HJ-NPR-Z0-9]{5}[A-L][0-9][0-9]{2}|[A-Z]{3}[A-HJ-NPR-Z0-9]{5}[A-L][0-9][0-9]{2}|[A-HJ-NPR-Z0-9]{3,17})$';
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_valid_vin(TEXT) TO gen_user;

-- Drop old CHECK constraints from vehicles table
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_format_ck;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_normalized_format_ck;

-- Add new CHECK constraints using is_valid_vin function
ALTER TABLE vehicles ADD CONSTRAINT vehicles_vin_format_ck CHECK (is_valid_vin(vin));
ALTER TABLE vehicles ADD CONSTRAINT vehicles_vin_normalized_format_ck CHECK (vin_normalized IS NULL OR is_valid_vin(vin_normalized));

-- Update vehicles upsert procedure to use new validation
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
      AND is_valid_vin(normalize_vin(vin_raw))
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
      OR NOT is_valid_vin(normalize_vin(vin_raw))
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

-- Update lots upsert procedure to use new validation
CREATE OR REPLACE FUNCTION upsert_lots_batch(staging_file_id UUID)
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
  -- Upsert lots from staging
  WITH upsert_result AS (
    INSERT INTO lots (
      lot_external_id,
      vin,
      source,
      site_code,
      yard_name,
      city,
      region,
      country,
      tz,
      auction_datetime_utc,
      retail_value_usd,
      status,
      damage_description,
      secondary_damage,
      title_type,
      has_keys,
      lot_condition_code,
      odometer,
      odometer_brand,
      repair_cost_usd,
      runs_drives,
      current_bid_usd,
      special_note,
      location_zip,
      currency_code,
      source_updated_at,
      updated_at
    )
    SELECT DISTINCT ON (lot_external_id)
      lot_external_id,
      normalize_vin(vin_raw),
      'copart',
      NULLIF(payload_jsonb->>'Yard number', ''),
      NULLIF(payload_jsonb->>'Yard name', ''),
      NULLIF(payload_jsonb->>'Location city', ''),
      NULLIF(payload_jsonb->>'Location state', ''),
      NULLIF(payload_jsonb->>'Location country', ''),
      NULLIF(payload_jsonb->>'Time Zone', ''),
      (NULLIF(payload_jsonb->>'Last Updated Time', ''))::TIMESTAMPTZ,
      NULLIF(payload_jsonb->>'Est. Retail Value', '')::NUMERIC::NUMERIC(12,2),
      COALESCE(
        CASE UPPER(NULLIF(payload_jsonb->>'Sale Status', ''))
          WHEN 'PURE SALE' THEN 'active'
          WHEN 'ON MINIMUM BID' THEN 'active'
          WHEN 'SOLD' THEN 'sold'
          WHEN 'FUTURE SALE' THEN 'upcoming'
          WHEN 'PENDING SALE' THEN 'upcoming'
          WHEN 'ON HOLD' THEN 'active'
          WHEN 'CANCELLED' THEN 'cancelled'
          ELSE 'active'
        END,
        'active'
      ),
      NULLIF(payload_jsonb->>'Damage Description', ''),
      NULLIF(payload_jsonb->>'Secondary Damage', ''),
      NULLIF(payload_jsonb->>'Sale Title Type', ''),
      CASE UPPER(NULLIF(payload_jsonb->>'Has Keys-Yes or No', ''))
        WHEN 'YES' THEN TRUE
        WHEN 'NO' THEN FALSE
        ELSE NULL
      END,
      NULLIF(payload_jsonb->>'Lot Cond. Code', ''),
      NULLIF(payload_jsonb->>'Odometer', '')::NUMERIC::NUMERIC(10,1),
      NULLIF(payload_jsonb->>'Odometer Brand', ''),
      NULLIF(payload_jsonb->>'Repair cost', '')::NUMERIC::NUMERIC(12,2),
      NULLIF(payload_jsonb->>'Runs/Drives', ''),
      NULLIF(payload_jsonb->>'High Bid =non-vix,Sealed=Vix', '')::NUMERIC::NUMERIC(12,2),
      NULLIF(payload_jsonb->>'Special Note', ''),
      NULLIF(payload_jsonb->>'Location ZIP', ''),
      NULLIF(payload_jsonb->>'Currency Code', ''),
      (NULLIF(payload_jsonb->>'Last Updated Time', ''))::TIMESTAMPTZ,
      now()
    FROM staging.copart_raw
    WHERE file_id = staging_file_id
      AND lot_external_id IS NOT NULL
      AND lot_external_id != ''
      AND vin_raw IS NOT NULL
      AND vin_raw != ''
      AND normalize_vin(vin_raw) IS NOT NULL
      AND is_valid_vin(normalize_vin(vin_raw))
      AND EXISTS (
        SELECT 1 FROM vehicles
        WHERE vin = normalize_vin(staging.copart_raw.vin_raw)
      )
    ORDER BY lot_external_id, window_start_utc DESC
    ON CONFLICT (lot_external_id)
    DO UPDATE SET
      vin = COALESCE(EXCLUDED.vin, lots.vin),
      site_code = COALESCE(EXCLUDED.site_code, lots.site_code),
      yard_name = COALESCE(EXCLUDED.yard_name, lots.yard_name),
      city = COALESCE(EXCLUDED.city, lots.city),
      region = COALESCE(EXCLUDED.region, lots.region),
      country = COALESCE(EXCLUDED.country, lots.country),
      tz = COALESCE(EXCLUDED.tz, lots.tz),
      auction_datetime_utc = COALESCE(EXCLUDED.auction_datetime_utc, lots.auction_datetime_utc),
      retail_value_usd = COALESCE(EXCLUDED.retail_value_usd, lots.retail_value_usd),
      status = COALESCE(EXCLUDED.status, lots.status),
      damage_description = COALESCE(EXCLUDED.damage_description, lots.damage_description),
      secondary_damage = COALESCE(EXCLUDED.secondary_damage, lots.secondary_damage),
      title_type = COALESCE(EXCLUDED.title_type, lots.title_type),
      has_keys = COALESCE(EXCLUDED.has_keys, lots.has_keys),
      lot_condition_code = COALESCE(EXCLUDED.lot_condition_code, lots.lot_condition_code),
      odometer = COALESCE(EXCLUDED.odometer, lots.odometer),
      odometer_brand = COALESCE(EXCLUDED.odometer_brand, lots.odometer_brand),
      repair_cost_usd = COALESCE(EXCLUDED.repair_cost_usd, lots.repair_cost_usd),
      runs_drives = COALESCE(EXCLUDED.runs_drives, lots.runs_drives),
      current_bid_usd = COALESCE(EXCLUDED.current_bid_usd, lots.current_bid_usd),
      special_note = COALESCE(EXCLUDED.special_note, lots.special_note),
      location_zip = COALESCE(EXCLUDED.location_zip, lots.location_zip),
      currency_code = COALESCE(EXCLUDED.currency_code, lots.currency_code),
      source_updated_at = EXCLUDED.source_updated_at,
      updated_at = now()
    WHERE lots.source_updated_at IS NULL
       OR lots.source_updated_at < EXCLUDED.source_updated_at
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    COUNT(*) FILTER (WHERE inserted),
    COUNT(*) FILTER (WHERE NOT inserted)
  INTO v_inserted, v_updated
  FROM upsert_result;

  -- Count skipped (missing VIN or orphan lots)
  SELECT COUNT(*) INTO v_skipped
  FROM staging.copart_raw
  WHERE file_id = staging_file_id
    AND (
      lot_external_id IS NULL
      OR lot_external_id = ''
      OR vin_raw IS NULL
      OR vin_raw = ''
      OR normalize_vin(vin_raw) IS NULL
      OR NOT is_valid_vin(normalize_vin(vin_raw))
      OR NOT EXISTS (
        SELECT 1 FROM vehicles
        WHERE vin = normalize_vin(staging.copart_raw.vin_raw)
      )
    );

  -- Log to audit
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION upsert_vehicles_batch(UUID) TO gen_user;
GRANT EXECUTE ON FUNCTION upsert_lots_batch(UUID) TO gen_user;

-- Add comment
COMMENT ON FUNCTION is_valid_vin(TEXT) IS 'Migration 0014: Comprehensive VIN validation supporting standard VIN, EU CIN, US HIN, and legacy formats';
