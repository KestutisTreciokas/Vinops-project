-- 0001_init.sql — Baseline schema (repo-first, no data loss)
-- vinops DB: vehicles, lots, sale_events, images
-- NOTE: Constraints/indices go to 0002_constraints.sql

CREATE TABLE IF NOT EXISTS vehicles (
  vin        TEXT PRIMARY KEY,   -- normalized VIN (upper-case, no I/O/Q) — constraint in 0002
  vin_raw    TEXT,               -- optional original user-provided VIN
  make       TEXT,
  model      TEXT,
  year       INTEGER,
  body       TEXT,
  fuel       TEXT,
  transmission TEXT,
  drive      TEXT,
  engine     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lots (
  id                  BIGSERIAL PRIMARY KEY,
  vin                 TEXT NOT NULL,  -- FK to vehicles(vin) in 0002
  source              TEXT,
  site_code           TEXT,
  city                TEXT,
  region              TEXT,
  country             TEXT,
  tz                  TEXT,
  auction_datetime_utc TIMESTAMPTZ,
  retail_value_usd    NUMERIC(12,2),
  status              TEXT,           -- domain check in 0002
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_events (
  id             BIGSERIAL PRIMARY KEY,
  vin            TEXT NOT NULL,  -- FK to vehicles(vin) in 0002
  lot_id         BIGINT,         -- FK to lots(id) in 0002
  sale_date      TIMESTAMPTZ,
  status         TEXT,           -- domain check in 0002
  final_bid_usd  NUMERIC(12,2),
  currency       CHAR(3),        -- ISO-4217 (check in 0002)
  collected_via  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS images (
  id           BIGSERIAL PRIMARY KEY,
  vin          TEXT NOT NULL,    -- FK to vehicles(vin) in 0002
  lot_id       BIGINT,           -- FK to lots(id) in 0002
  seq          INTEGER NOT NULL, -- display order
  variant      TEXT,             -- e.g., 'thumb','full','map','doc'
  storage_key  TEXT,
  source_url   TEXT,
  width        INTEGER,
  height       INTEGER,
  bytes        BIGINT,
  content_hash TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rollback strategy: documented in README.migrations.md; this file avoids destructive ops.
