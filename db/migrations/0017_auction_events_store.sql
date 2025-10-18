-- Migration: 0017_auction_events_store.sql
-- Sprint: P0 — Copart Final Bid Implementation (PoC 1)
-- Purpose: Create immutable event store for tracking CSV changes over time
-- Dependencies: 0015_completion_detection.sql
-- Date: 2025-10-18
-- Risk: MINIMAL (additive only, no existing data modification)

-- ============================================================================
-- ROLLBACK COMMANDS (execute in reverse order if needed)
-- ============================================================================
/*
DROP VIEW IF EXISTS audit.v_lot_event_timeline;
DROP VIEW IF EXISTS audit.v_relist_candidates;
DROP INDEX IF EXISTS idx_auction_events_lot_external_id;
DROP INDEX IF EXISTS idx_auction_events_vin;
DROP INDEX IF EXISTS idx_auction_events_timestamp;
DROP INDEX IF EXISTS idx_auction_events_type;
DROP TABLE IF EXISTS audit.auction_events;
ALTER TABLE lots DROP COLUMN IF EXISTS relist_count;
ALTER TABLE lots DROP COLUMN IF EXISTS previous_lot_id;
ALTER TABLE lots DROP COLUMN IF EXISTS outcome;
ALTER TABLE lots DROP COLUMN IF EXISTS outcome_date;
ALTER TABLE lots DROP COLUMN IF EXISTS outcome_confidence;
*/

-- ============================================================================
-- 1. Create immutable event store for CSV changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit.auction_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
    -- 'lot.appeared', 'lot.disappeared', 'lot.relist', 'lot.updated',
    -- 'lot.price_change', 'lot.date_change', 'lot.status_change'
  lot_external_id VARCHAR(50) NOT NULL,
  vin VARCHAR(17), -- nullable for lots without VIN
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_data JSONB NOT NULL, -- snapshot of lot data at event time
  csv_file_id UUID REFERENCES raw.csv_files(file_id),
  previous_csv_file_id UUID REFERENCES raw.csv_files(file_id),

  -- Additional metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit.auction_events IS
  'Immutable event store tracking all lot state changes detected via CSV diff. '
  'Used for outcome heuristics, relist detection, and audit trail.';

COMMENT ON COLUMN audit.auction_events.event_type IS
  'Type of event detected: lot.appeared (new lot in CSV), lot.disappeared (removed from CSV), '
  'lot.relist (same VIN reappeared with new lot_external_id), lot.updated (field changes), '
  'lot.price_change (current_bid changed), lot.date_change (auction_datetime changed), '
  'lot.status_change (status field changed)';

COMMENT ON COLUMN audit.auction_events.event_data IS
  'JSONB snapshot of lot data at time of event. For lot.updated events, includes both '
  '"before" and "after" states. For lot.disappeared, includes last known state.';

-- ============================================================================
-- 2. Create indexes for event queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_auction_events_lot_external_id
  ON audit.auction_events(lot_external_id);

CREATE INDEX IF NOT EXISTS idx_auction_events_vin
  ON audit.auction_events(vin) WHERE vin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auction_events_timestamp
  ON audit.auction_events(event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_auction_events_type
  ON audit.auction_events(event_type);

CREATE INDEX IF NOT EXISTS idx_auction_events_csv_file
  ON audit.auction_events(csv_file_id);

-- Composite index for timeline queries (vin + timestamp)
CREATE INDEX IF NOT EXISTS idx_auction_events_vin_timestamp
  ON audit.auction_events(vin, event_timestamp DESC)
  WHERE vin IS NOT NULL;

-- Composite index for relist detection (vin + type + timestamp)
CREATE INDEX IF NOT EXISTS idx_auction_events_relist_lookup
  ON audit.auction_events(vin, event_type, event_timestamp DESC)
  WHERE vin IS NOT NULL AND event_type IN ('lot.appeared', 'lot.relist');

-- ============================================================================
-- 3. Add outcome tracking columns to lots table
-- ============================================================================

-- Check if outcome column already exists (might be from 0015)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lots'
      AND column_name = 'outcome'
  ) THEN
    ALTER TABLE lots ADD COLUMN outcome VARCHAR(20);
    COMMENT ON COLUMN lots.outcome IS
      'Lot outcome: sold, not_sold, on_approval, unknown. '
      'Populated via heuristics from auction_events analysis.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lots'
      AND column_name = 'outcome_date'
  ) THEN
    ALTER TABLE lots ADD COLUMN outcome_date TIMESTAMPTZ;
    COMMENT ON COLUMN lots.outcome_date IS
      'Timestamp when outcome was determined (typically auction completion + grace period).';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lots'
      AND column_name = 'outcome_confidence'
  ) THEN
    ALTER TABLE lots ADD COLUMN outcome_confidence DECIMAL(3,2);
    COMMENT ON COLUMN lots.outcome_confidence IS
      'Confidence score 0.00-1.00 for outcome heuristic. '
      'CSV-only: 0.85 (sold), 0.95 (not_sold via relist), 0.60 (on_approval).';
  END IF;
END $$;

-- Note: final_bid_usd should exist from 0015, but check anyway
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lots'
      AND column_name = 'final_bid_usd'
  ) THEN
    ALTER TABLE lots ADD COLUMN final_bid_usd DECIMAL(12,2);
    COMMENT ON COLUMN lots.final_bid_usd IS
      'Final sale price (NULL for CSV-only method, populated via JSON API scraper if enabled).';
  END IF;
END $$;

-- ============================================================================
-- 4. Add relist tracking columns
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lots'
      AND column_name = 'relist_count'
  ) THEN
    ALTER TABLE lots ADD COLUMN relist_count INTEGER DEFAULT 0;
    COMMENT ON COLUMN lots.relist_count IS
      'Number of times this VIN has been relisted (0 = first attempt).';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lots'
      AND column_name = 'previous_lot_id'
  ) THEN
    ALTER TABLE lots ADD COLUMN previous_lot_id BIGINT REFERENCES lots(id);
    COMMENT ON COLUMN lots.previous_lot_id IS
      'Foreign key to previous lot attempt for same VIN (NULL if first attempt).';
  END IF;
END $$;

-- Create index for relist chain traversal
CREATE INDEX IF NOT EXISTS idx_lots_previous_lot_id
  ON lots(previous_lot_id) WHERE previous_lot_id IS NOT NULL;

-- ============================================================================
-- 5. Create views for analysis
-- ============================================================================

-- View: Timeline of all events for a specific lot
CREATE OR REPLACE VIEW audit.v_lot_event_timeline AS
SELECT
  ae.id,
  ae.event_type,
  ae.lot_external_id,
  ae.vin,
  ae.event_timestamp,
  ae.event_data,
  cf.path as csv_file_path,
  cf.ingested_at as csv_ingested_at,
  l.id as lot_id,
  l.outcome,
  l.outcome_confidence,
  l.auction_datetime_utc
FROM audit.auction_events ae
LEFT JOIN raw.csv_files cf ON ae.csv_file_id = cf.file_id
LEFT JOIN lots l ON ae.lot_external_id = l.lot_external_id
ORDER BY ae.event_timestamp DESC;

COMMENT ON VIEW audit.v_lot_event_timeline IS
  'Timeline view of all events for lots, with CSV file context and current outcome status.';

-- View: VINs with multiple relist events (candidates for not_sold marking)
CREATE OR REPLACE VIEW audit.v_relist_candidates AS
SELECT
  vin,
  COUNT(DISTINCT lot_external_id) as lot_count,
  ARRAY_AGG(DISTINCT lot_external_id ORDER BY lot_external_id) as lot_ids,
  MIN(event_timestamp) as first_seen,
  MAX(event_timestamp) as last_seen,
  ARRAY_AGG(DISTINCT event_type ORDER BY event_type) as event_types
FROM audit.auction_events
WHERE vin IS NOT NULL
  AND event_type IN ('lot.appeared', 'lot.relist')
GROUP BY vin
HAVING COUNT(DISTINCT lot_external_id) > 1
ORDER BY lot_count DESC, last_seen DESC;

COMMENT ON VIEW audit.v_relist_candidates IS
  'VINs with multiple lot appearances, indicating relist events. Use for not_sold outcome detection.';

-- ============================================================================
-- 6. Create VIN history view (enhanced from ADR)
-- ============================================================================

CREATE OR REPLACE VIEW audit.v_vin_auction_history AS
SELECT
  v.vin,
  l.id as lot_id,
  l.lot_external_id,
  l.auction_datetime_utc,
  l.outcome,
  l.outcome_confidence,
  l.final_bid_usd,
  l.current_bid_usd,
  l.relist_count,
  l.previous_lot_id,
  l.created_at,
  ROW_NUMBER() OVER (PARTITION BY v.vin ORDER BY l.auction_datetime_utc NULLS LAST, l.created_at) as attempt_number
FROM vehicles v
LEFT JOIN lots l ON l.vin = v.vin
WHERE NOT l.is_removed
ORDER BY v.vin, l.auction_datetime_utc NULLS LAST, l.created_at;

COMMENT ON VIEW audit.v_vin_auction_history IS
  'Complete auction history for each VIN, showing all attempts in chronological order.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table created
SELECT 'auction_events table created' as status
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'audit' AND table_name = 'auction_events'
);

-- Verify indexes created
SELECT 'Indexes created: ' || COUNT(*) as status
FROM pg_indexes
WHERE tablename = 'auction_events' AND schemaname = 'audit';

-- Verify new columns added to lots
SELECT
  'lots table columns: ' ||
  STRING_AGG(column_name, ', ' ORDER BY column_name) as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lots'
  AND column_name IN ('outcome', 'outcome_date', 'outcome_confidence', 'relist_count', 'previous_lot_id', 'final_bid_usd');

-- Verify views created
SELECT 'Views created: ' || COUNT(*) as status
FROM information_schema.views
WHERE table_schema = 'audit'
  AND table_name IN ('v_lot_event_timeline', 'v_relist_candidates', 'v_vin_auction_history');

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 0017 Applied Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - audit.auction_events table (event store)';
  RAISE NOTICE '  - 7 indexes for efficient event queries';
  RAISE NOTICE '  - 6 columns added to lots table';
  RAISE NOTICE '  - 3 analysis views';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Create scripts/csv-diff.js';
  RAISE NOTICE '  2. Create scripts/outcome-resolver.js';
  RAISE NOTICE '  3. Test with sample CSV files';
  RAISE NOTICE '';
END $$;
