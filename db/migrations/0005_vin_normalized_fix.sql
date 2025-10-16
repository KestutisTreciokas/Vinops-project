-- 0005_vin_normalized_fix.sql — add missing CHECK + UNIQUE index for vin_normalized (idempotent)
-- Context: 0002 fell on "ADD CONSTRAINT IF NOT EXISTS" (unsupported in PG). We add via guarded DO-blocks.

BEGIN;

-- Ensure column exists (do not alter to GENERATED here to avoid breaking changes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vehicles' AND column_name='vin_normalized'
  ) THEN
    ALTER TABLE public.vehicles ADD COLUMN vin_normalized TEXT;
  END IF;
END $$;

-- Backfill vin_normalized from vin where NULL
UPDATE public.vehicles
   SET vin_normalized = vin
 WHERE vin_normalized IS NULL;

-- Add CHECK on vin_normalized (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_vin_normalized_format_ck'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_vin_normalized_format_ck
      CHECK (vin_normalized IS NULL OR vin_normalized ~ '^[A-HJ-NPR-Z0-9]{11,17}$');
  END IF;
END $$;

-- Add UNIQUE index on vin_normalized (guarded)
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_vin_normalized_uidx
  ON public.vehicles (vin_normalized);

COMMIT;

-- Rollback strategy:
--   DROP INDEX IF EXISTS vehicles_vin_normalized_uidx;
--   ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_normalized_format_ck;
