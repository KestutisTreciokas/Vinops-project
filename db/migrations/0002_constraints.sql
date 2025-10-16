-- 0002_constraints.sql — Constraints, FKs, Indexes (no data loss)
-- VIN rule: 11–17 chars, upper-case, excluding I/O/Q → class [A-HJ-NPR-Z0-9]
-- Status domain: 'sold','active','upcoming','cancelled','withdrawn'
-- NOTE: If existing prod data may violate checks, apply as NOT VALID and validate later.

BEGIN;

-- VIN format (normalized in vehicles.vin)
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_vin_format_ck
  CHECK (vin ~ '^[A-HJ-NPR-Z0-9]{11,17}$');

-- Year sanity (non-breaking)
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_year_ck
  CHECK (year IS NULL OR year BETWEEN 1900 AND 2100);

-- Lots ↔ Vehicles
ALTER TABLE lots
  ADD CONSTRAINT lots_vin_fkey
  FOREIGN KEY (vin) REFERENCES vehicles(vin)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- Sale events ↔ Vehicles/Lots
ALTER TABLE sale_events
  ADD CONSTRAINT sale_events_vin_fkey
  FOREIGN KEY (vin) REFERENCES vehicles(vin)
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE sale_events
  ADD CONSTRAINT sale_events_lot_id_fkey
  FOREIGN KEY (lot_id) REFERENCES lots(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

-- Images ↔ Vehicles/Lots
ALTER TABLE images
  ADD CONSTRAINT images_vin_fkey
  FOREIGN KEY (vin) REFERENCES vehicles(vin)
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE images
  ADD CONSTRAINT images_lot_id_fkey
  FOREIGN KEY (lot_id) REFERENCES lots(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

-- Status domains (lots + sale_events)
ALTER TABLE lots
  ADD CONSTRAINT lots_status_ck
  CHECK (status IS NULL OR status IN ('sold','active','upcoming','cancelled','withdrawn'));

ALTER TABLE sale_events
  ADD CONSTRAINT sale_events_status_ck
  CHECK (status IS NULL OR status IN ('sold','active','upcoming','cancelled','withdrawn'));

-- Currency format (ISO-4217 alpha-3)
ALTER TABLE sale_events
  ADD CONSTRAINT sale_events_currency_ck
  CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');

-- Non-negative money & image dims
ALTER TABLE sale_events
  ADD CONSTRAINT sale_events_final_bid_nonneg_ck
  CHECK (final_bid_usd IS NULL OR final_bid_usd >= 0);

ALTER TABLE lots
  ADD CONSTRAINT lots_retail_nonneg_ck
  CHECK (retail_value_usd IS NULL OR retail_value_usd >= 0);

ALTER TABLE images
  ADD CONSTRAINT images_wh_nonneg_ck
  CHECK ((width IS NULL OR width >= 0) AND (height IS NULL OR height >= 0) AND (bytes IS NULL OR bytes >= 0));

-- Uniqueness of image sequence per VIN/lot/variant
-- (variant may be NULL → use functional UNIQUE index to treat NULLs as same bucket)
CREATE UNIQUE INDEX IF NOT EXISTS images_uni_vin_lot_seq_variant
  ON images (vin, lot_id, seq, COALESCE(variant,''));

-- Catalog/Card read indices
CREATE INDEX IF NOT EXISTS lots_status_auction_idx ON lots (status, auction_datetime_utc DESC);
CREATE INDEX IF NOT EXISTS lots_vin_idx           ON lots (vin);
CREATE INDEX IF NOT EXISTS sale_events_vin_date_idx ON sale_events (vin, sale_date DESC);
CREATE INDEX IF NOT EXISTS images_vin_idx         ON images (vin);
CREATE INDEX IF NOT EXISTS images_lot_idx         ON images (lot_id);

COMMIT;
-- === MS-02-01 (QA fix) additions: VIN normalized + extra read indices ===

-- Explicit normalized column for VIN (searchable), derived from vin
-- If Postgres >= 12: stored generated column; otherwise will be handled in S-03 fallback (trigger).
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS vin_normalized TEXT GENERATED ALWAYS AS (upper(vin)) STORED;

-- CHECK on normalized VIN value (11–17, exclude I/O/Q)
ALTER TABLE vehicles
  ADD CONSTRAINT IF NOT EXISTS vehicles_vin_normalized_format_ck
  CHECK (vin_normalized ~ '^[A-HJ-NPR-Z0-9]{11,17}$');

-- Unique index on normalized VIN (mirrors PK on vin; used by read paths)
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_vin_normalized_uidx
  ON vehicles (vin_normalized);

-- Read-path indices requested by S-02:
-- sale_events: (vin, sale_date DESC)
CREATE INDEX IF NOT EXISTS sale_events_vin_date_idx
  ON sale_events (vin, sale_date DESC);

-- images: (vin), (lot_id)
CREATE INDEX IF NOT EXISTS images_vin_idx
  ON images (vin);

CREATE INDEX IF NOT EXISTS images_lot_id_idx
  ON images (lot_id);
-- === /MS-02-01 additions ===

-- Rollback strategy: documented in README.migrations.md; this file avoids destructive ops.
