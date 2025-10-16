-- 0009_lots_external_id.sql — Add Copart external ID and source timestamp
-- Sprint: S1 — ETL A (CSV→PG)
-- Dependencies: 0008_etl_schemas.sql

ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS lot_external_id TEXT;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lots_external_id_unique ON public.lots(lot_external_id);
CREATE INDEX IF NOT EXISTS idx_lots_source_updated ON public.lots(source_updated_at);

COMMENT ON COLUMN public.lots.lot_external_id IS 'Copart "Lot number" (upsert key)';
COMMENT ON COLUMN public.lots.source_updated_at IS 'CSV "Last Updated Time" (conflict resolution)';

-- Rollback:
-- DROP INDEX IF EXISTS idx_lots_external_id_unique;
-- DROP INDEX IF EXISTS idx_lots_source_updated;
-- ALTER TABLE public.lots DROP COLUMN IF EXISTS lot_external_id, DROP COLUMN IF EXISTS source_updated_at;
