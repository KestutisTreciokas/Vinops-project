-- 0007_canon_domains_columns.sql — Canon-пары *_code/_raw (недеструктивно)
-- Таблицы домена сейчас в public.* — добавляем поля здесь (идемпотентно).

BEGIN;

-- vehicles: нормализация справочников
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS fuel_code           TEXT,
  ADD COLUMN IF NOT EXISTS fuel_raw            TEXT,
  ADD COLUMN IF NOT EXISTS transmission_code   TEXT,
  ADD COLUMN IF NOT EXISTS transmission_raw    TEXT,
  ADD COLUMN IF NOT EXISTS drive_code          TEXT,
  ADD COLUMN IF NOT EXISTS drive_raw           TEXT,
  ADD COLUMN IF NOT EXISTS body_style_code     TEXT,
  ADD COLUMN IF NOT EXISTS body_style_raw      TEXT,
  ADD COLUMN IF NOT EXISTS color_code          TEXT,
  ADD COLUMN IF NOT EXISTS color_raw           TEXT,
  ADD COLUMN IF NOT EXISTS engine_raw          TEXT;

-- lots: домены урона/титула/потери/одометра
ALTER TABLE public.lots
  ADD COLUMN IF NOT EXISTS damage_code         TEXT,
  ADD COLUMN IF NOT EXISTS damage_raw          TEXT,
  ADD COLUMN IF NOT EXISTS title_code          TEXT,
  ADD COLUMN IF NOT EXISTS title_raw           TEXT,
  ADD COLUMN IF NOT EXISTS loss_code           TEXT,
  ADD COLUMN IF NOT EXISTS loss_raw            TEXT,
  ADD COLUMN IF NOT EXISTS odometer_brand_code TEXT,
  ADD COLUMN IF NOT EXISTS odometer_brand_raw  TEXT;

-- sale_events: статус продажи
ALTER TABLE public.sale_events
  ADD COLUMN IF NOT EXISTS sale_status_code    TEXT,
  ADD COLUMN IF NOT EXISTS sale_status_raw     TEXT;

COMMIT;

-- Rollback strategy: ALTER TABLE ... DROP COLUMN ... (только отдельной согласованной миграцией).
