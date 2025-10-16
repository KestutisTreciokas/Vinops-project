-- Migration 0015: Completion Detection
-- Sprint: S1C — Completion Detection (Phase 1: Safe, Passive)
-- Purpose: Add columns and functions for detecting auction completions via CSV disappearance
-- Date: 2025-10-16

-- Add completion tracking columns to lots table
ALTER TABLE lots ADD COLUMN IF NOT EXISTS final_bid_usd NUMERIC(12,2);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS sale_confirmed_at TIMESTAMPTZ;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS detection_method TEXT;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS detection_notes TEXT;

-- Expand status domain to include completion statuses
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_status_check;
ALTER TABLE lots ADD CONSTRAINT lots_status_check
  CHECK (status IN (
    'active',          -- Currently at auction or bidding open
    'upcoming',        -- Auction scheduled but not yet started
    'sold',            -- Confirmed sale
    'not_sold',        -- Confirmed no sale (via VIN reappearance)
    'pending_result',  -- Auction ended, awaiting result confirmation
    'on_approval',     -- Sale pending seller approval
    'cancelled',       -- Lot removed before auction
    'removed'          -- Legacy status from earlier migrations
  ));

-- Create audit table for completion detections
CREATE TABLE IF NOT EXISTS audit.completion_detections (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID DEFAULT gen_random_uuid(),
  detection_timestamp TIMESTAMPTZ DEFAULT now(),
  prev_file_id UUID NOT NULL,
  curr_file_id UUID NOT NULL,
  lots_disappeared INT DEFAULT 0,
  lots_marked_pending INT DEFAULT 0,
  lots_marked_not_sold INT DEFAULT 0,
  errors_count INT DEFAULT 0,
  error_summary TEXT,
  execution_time_ms INT,
  CONSTRAINT fk_prev_file FOREIGN KEY (prev_file_id) REFERENCES raw.csv_files(file_id),
  CONSTRAINT fk_curr_file FOREIGN KEY (curr_file_id) REFERENCES raw.csv_files(file_id)
);

CREATE INDEX idx_completion_detections_timestamp ON audit.completion_detections(detection_timestamp DESC);
CREATE INDEX idx_completion_detections_run_id ON audit.completion_detections(run_id);

-- Create function to detect disappeared lots
CREATE OR REPLACE FUNCTION detect_disappeared_lots(
  prev_file_id UUID,
  curr_file_id UUID,
  grace_period_hours NUMERIC DEFAULT 1
) RETURNS TABLE(
  lot_external_id TEXT,
  vin TEXT,
  auction_datetime_utc TIMESTAMPTZ,
  hours_since_auction NUMERIC,
  current_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    prev.lot_external_id,
    prev.vin_raw,
    l.auction_datetime_utc,
    EXTRACT(EPOCH FROM (now() - l.auction_datetime_utc)) / 3600 as hours_since_auction,
    l.status as current_status
  FROM staging.copart_raw prev
  LEFT JOIN staging.copart_raw curr
    ON prev.lot_external_id = curr.lot_external_id
    AND curr.file_id = curr_file_id
  JOIN lots l ON l.lot_external_id = prev.lot_external_id
  WHERE prev.file_id = prev_file_id
    AND curr.lot_external_id IS NULL  -- Disappeared from current CSV
    AND l.auction_datetime_utc < now() - (grace_period_hours || ' hours')::INTERVAL
    AND l.status IN ('active', 'upcoming')
  ORDER BY l.auction_datetime_utc DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to mark disappeared lots as pending_result
CREATE OR REPLACE FUNCTION mark_lots_pending_result(
  prev_file_id UUID,
  curr_file_id UUID,
  grace_period_hours NUMERIC DEFAULT 1
) RETURNS TABLE(
  updated_count INT,
  lot_ids TEXT[]
) AS $$
DECLARE
  v_updated_count INT := 0;
  v_lot_ids TEXT[];
BEGIN
  -- Mark disappeared lots as pending_result
  WITH updated AS (
    UPDATE lots
    SET
      status = 'pending_result',
      sale_confirmed_at = now(),
      detection_method = 'csv_disappearance',
      detection_notes = format('Disappeared from CSV after auction (prev: %s, curr: %s)',
                               prev_file_id, curr_file_id),
      updated_at = now()
    WHERE lot_external_id IN (
      SELECT d.lot_external_id
      FROM detect_disappeared_lots(prev_file_id, curr_file_id, grace_period_hours) d
    )
    RETURNING lot_external_id
  )
  SELECT COUNT(*)::INT, ARRAY_AGG(lot_external_id)
  INTO v_updated_count, v_lot_ids
  FROM updated;

  RETURN QUERY SELECT v_updated_count, v_lot_ids;
END;
$$ LANGUAGE plpgsql;

-- Create function to detect VIN reappearances and mark previous as not_sold
CREATE OR REPLACE FUNCTION detect_vin_reappearances(
  curr_file_id UUID
) RETURNS TABLE(
  vin TEXT,
  prev_lot_id TEXT,
  prev_auction_date TIMESTAMPTZ,
  new_lot_id TEXT,
  new_auction_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH vin_appearances AS (
    SELECT
      l.vin,
      l.lot_external_id,
      l.auction_datetime_utc,
      LAG(l.lot_external_id) OVER (PARTITION BY l.vin ORDER BY l.auction_datetime_utc) as prev_lot_id,
      LAG(l.auction_datetime_utc) OVER (PARTITION BY l.vin ORDER BY l.auction_datetime_utc) as prev_auction_date
    FROM lots l
    WHERE l.vin IS NOT NULL
      AND l.lot_external_id IN (
        -- Only consider lots from current CSV
        SELECT DISTINCT lot_external_id
        FROM staging.copart_raw
        WHERE file_id = curr_file_id
      )
  )
  SELECT
    va.vin,
    va.prev_lot_id,
    va.prev_auction_date,
    va.lot_external_id as new_lot_id,
    va.auction_datetime_utc as new_auction_date
  FROM vin_appearances va
  WHERE va.prev_lot_id IS NOT NULL
    AND EXISTS (
      -- Previous lot exists and is in pending_result state
      SELECT 1 FROM lots l
      WHERE l.lot_external_id = va.prev_lot_id
        AND l.status = 'pending_result'
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to mark previous lots as not_sold based on VIN reappearance
CREATE OR REPLACE FUNCTION mark_lots_not_sold_by_reappearance(
  curr_file_id UUID
) RETURNS TABLE(
  updated_count INT,
  lot_ids TEXT[]
) AS $$
DECLARE
  v_updated_count INT := 0;
  v_lot_ids TEXT[];
BEGIN
  -- Mark previous lots as not_sold when VIN reappears
  WITH updated AS (
    UPDATE lots
    SET
      status = 'not_sold',
      detection_method = 'vin_reappearance',
      detection_notes = format('VIN reappeared with new lot_external_id (file: %s)', curr_file_id),
      updated_at = now()
    WHERE lot_external_id IN (
      SELECT r.prev_lot_id
      FROM detect_vin_reappearances(curr_file_id) r
    )
    RETURNING lot_external_id
  )
  SELECT COUNT(*)::INT, ARRAY_AGG(lot_external_id)
  INTO v_updated_count, v_lot_ids
  FROM updated;

  RETURN QUERY SELECT v_updated_count, v_lot_ids;
END;
$$ LANGUAGE plpgsql;

-- Create comprehensive completion detection function
CREATE OR REPLACE FUNCTION run_completion_detection(
  prev_file_id UUID,
  curr_file_id UUID,
  grace_period_hours NUMERIC DEFAULT 1
) RETURNS TABLE(
  disappeared_count INT,
  marked_pending_count INT,
  marked_not_sold_count INT,
  execution_time_ms INT
) AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_disappeared_count INT := 0;
  v_marked_pending_count INT := 0;
  v_marked_not_sold_count INT := 0;
  v_execution_time_ms INT;
  v_pending_lots TEXT[];
  v_not_sold_lots TEXT[];
BEGIN
  v_start_time := clock_timestamp();

  -- Count disappeared lots
  SELECT COUNT(*)::INT INTO v_disappeared_count
  FROM detect_disappeared_lots(prev_file_id, curr_file_id, grace_period_hours);

  -- Mark disappeared lots as pending_result
  SELECT updated_count, lot_ids INTO v_marked_pending_count, v_pending_lots
  FROM mark_lots_pending_result(prev_file_id, curr_file_id, grace_period_hours);

  -- Mark previous lots as not_sold based on VIN reappearance
  SELECT updated_count, lot_ids INTO v_marked_not_sold_count, v_not_sold_lots
  FROM mark_lots_not_sold_by_reappearance(curr_file_id);

  v_end_time := clock_timestamp();
  v_execution_time_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INT;

  -- Log to audit table
  INSERT INTO audit.completion_detections (
    prev_file_id,
    curr_file_id,
    lots_disappeared,
    lots_marked_pending,
    lots_marked_not_sold,
    execution_time_ms
  ) VALUES (
    prev_file_id,
    curr_file_id,
    v_disappeared_count,
    v_marked_pending_count,
    v_marked_not_sold_count,
    v_execution_time_ms
  );

  RETURN QUERY SELECT
    v_disappeared_count,
    v_marked_pending_count,
    v_marked_not_sold_count,
    v_execution_time_ms;
END;
$$ LANGUAGE plpgsql;

-- Create view for completion detection statistics
CREATE OR REPLACE VIEW audit.v_completion_stats AS
SELECT
  DATE_TRUNC('day', sale_confirmed_at) as day,
  detection_method,
  COUNT(*) as total_detections,
  AVG(final_bid_usd) FILTER (WHERE final_bid_usd IS NOT NULL) as avg_final_bid,
  COUNT(*) FILTER (WHERE status = 'sold') as sold_count,
  COUNT(*) FILTER (WHERE status = 'not_sold') as not_sold_count,
  COUNT(*) FILTER (WHERE status = 'pending_result') as pending_count,
  COUNT(*) FILTER (WHERE status = 'on_approval') as on_approval_count
FROM lots
WHERE sale_confirmed_at IS NOT NULL
GROUP BY DATE_TRUNC('day', sale_confirmed_at), detection_method
ORDER BY day DESC, detection_method;

-- Create view for pending result lots summary
CREATE OR REPLACE VIEW audit.v_pending_results AS
SELECT
  l.lot_external_id,
  l.vin,
  l.make,
  l.model,
  l.year,
  l.auction_datetime_utc,
  l.sale_confirmed_at,
  EXTRACT(HOURS FROM (now() - l.sale_confirmed_at)) as hours_pending,
  l.detection_method,
  l.detection_notes
FROM lots l
WHERE l.status = 'pending_result'
ORDER BY l.sale_confirmed_at DESC;

-- Grant permissions
GRANT SELECT ON audit.completion_detections TO gen_user;
GRANT INSERT ON audit.completion_detections TO gen_user;
GRANT USAGE, SELECT ON SEQUENCE audit.completion_detections_id_seq TO gen_user;
GRANT EXECUTE ON FUNCTION detect_disappeared_lots(UUID, UUID, NUMERIC) TO gen_user;
GRANT EXECUTE ON FUNCTION mark_lots_pending_result(UUID, UUID, NUMERIC) TO gen_user;
GRANT EXECUTE ON FUNCTION detect_vin_reappearances(UUID) TO gen_user;
GRANT EXECUTE ON FUNCTION mark_lots_not_sold_by_reappearance(UUID) TO gen_user;
GRANT EXECUTE ON FUNCTION run_completion_detection(UUID, UUID, NUMERIC) TO gen_user;
GRANT SELECT ON audit.v_completion_stats TO gen_user;
GRANT SELECT ON audit.v_pending_results TO gen_user;

-- Add comments
COMMENT ON FUNCTION run_completion_detection(UUID, UUID, NUMERIC) IS 'Migration 0015: Run complete completion detection (Phase 1: CSV disappearance + VIN reappearance)';
COMMENT ON TABLE audit.completion_detections IS 'Audit log for completion detection runs';
COMMENT ON COLUMN lots.detection_method IS 'Method used to detect completion: csv_disappearance, vin_reappearance, scraped';
COMMENT ON COLUMN lots.sale_confirmed_at IS 'Timestamp when lot completion was first detected';
