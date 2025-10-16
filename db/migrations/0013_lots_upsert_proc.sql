-- Migration 0013: Lots Upsert Procedure
-- Sprint: S1B ETL — Core Upsert (Lots)
-- Purpose: Batch upsert from staging.copart_raw to public.lots
-- Date: 2025-10-16

-- Add missing columns to lots table
ALTER TABLE lots ADD COLUMN IF NOT EXISTS lot_external_id TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS yard_name TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS sale_date_raw INTEGER;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS sale_day_of_week TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS sale_time_hhmm TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS item_number INTEGER;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS damage_description TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS secondary_damage TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS title_type TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS lot_condition_code TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS odometer NUMERIC(10,1);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS odometer_brand TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS repair_cost_usd NUMERIC(12,2);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS runs_drives TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS current_bid_usd NUMERIC(12,2);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS special_note TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS location_zip TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS currency_code CHAR(3);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS created_at_raw TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS grid_row TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS make_offer_eligible BOOLEAN;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS buy_it_now_usd NUMERIC(12,2);

-- Create unique constraint on lot_external_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_lots_external_id_unique ON lots(lot_external_id) WHERE lot_external_id IS NOT NULL;

-- Create stored procedure for batch lots upsert
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

-- Create audit table for lot conflicts
CREATE TABLE IF NOT EXISTS audit.lot_conflicts (
  id BIGSERIAL PRIMARY KEY,
  lot_external_id TEXT NOT NULL,
  file_id UUID NOT NULL,
  conflict_type TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  resolved_value JSONB,
  detected_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lot_conflicts_lot_id ON audit.lot_conflicts(lot_external_id);
CREATE INDEX idx_lot_conflicts_detected_at ON audit.lot_conflicts(detected_at DESC);

-- Grant permissions
GRANT EXECUTE ON FUNCTION upsert_lots_batch(UUID) TO gen_user;
GRANT INSERT, SELECT ON audit.lot_conflicts TO gen_user;
GRANT USAGE, SELECT ON SEQUENCE audit.lot_conflicts_id_seq TO gen_user;

-- Update INDEX.md registry
COMMENT ON FUNCTION upsert_lots_batch(UUID) IS 'Migration 0013: Batch upsert lots from staging with orphan prevention';
