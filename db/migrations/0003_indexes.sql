-- 0003_indexes.sql — Read-path indexes (catalog & VIN card)
-- NOTE: Guarded with IF NOT EXISTS to remain idempotent relative to 0002.
-- Rollback strategy:
--   DROP INDEX IF EXISTS lots_status_auction_idx;
--   DROP INDEX IF EXISTS lots_vin_idx;
--   DROP INDEX IF EXISTS sale_events_vin_date_idx;
--   DROP INDEX IF EXISTS images_vin_idx;
--   DROP INDEX IF EXISTS images_lot_id_idx;

-- Catalog list: sort & filter
CREATE INDEX IF NOT EXISTS lots_status_auction_idx ON lots (status, auction_datetime_utc DESC);
CREATE INDEX IF NOT EXISTS lots_vin_idx            ON lots (vin);

-- VIN card: timeline & gallery
CREATE INDEX IF NOT EXISTS sale_events_vin_date_idx ON sale_events (vin, sale_date DESC);
CREATE INDEX IF NOT EXISTS images_vin_idx           ON images (vin);
CREATE INDEX IF NOT EXISTS images_lot_id_idx        ON images (lot_id);
