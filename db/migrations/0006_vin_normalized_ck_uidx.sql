-- 0006_vin_normalized_ck_uidx.sql — guard-only: CHECK + UNIQUE на vin_normalized без апдейтов
-- Предпосылка: vehicles.vin_normalized — GENERATED ALWAYS; обновлять колонку нельзя.

BEGIN;

-- CHECK на формат (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='vehicles' AND c.conname='vehicles_vin_normalized_format_ck'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_vin_normalized_format_ck
      CHECK (vin_normalized IS NULL OR vin_normalized ~ '^[A-HJ-NPR-Z0-9]{11,17}$');
  END IF;
END $$;

-- UNIQUE индекс (guarded)
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_vin_normalized_uidx
  ON public.vehicles (vin_normalized);

COMMIT;

-- Rollback:
--   DROP INDEX IF EXISTS public.vehicles_vin_normalized_uidx;
--   ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_normalized_format_ck;
