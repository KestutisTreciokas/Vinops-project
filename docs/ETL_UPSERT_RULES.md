# ETL Upsert Rules — Copart Lots

## Primary Key
`lots.lot_external_id` (Copart "Lot number")

## Conflict Resolution
Last-write-wins via `source_updated_at` (CSV "Last Updated Time")

## Upsert Logic
```sql
INSERT INTO lots (lot_external_id, vin, source_updated_at, ...)
VALUES (?, ?, ?, ...)
ON CONFLICT (lot_external_id)
DO UPDATE SET
  vin = EXCLUDED.vin,
  ...,
  source_updated_at = EXCLUDED.source_updated_at,
  updated_at = now()
WHERE lots.source_updated_at IS NULL
   OR EXCLUDED.source_updated_at > lots.source_updated_at;
```

## VIN Conflicts
- Log to `audit.vin_conflicts` if normalized VIN collision detected
- Allow NULL VIN (0.01% of rows); skip vehicle upsert

## Idempotence
- Re-importing same CSV (by sha256) skips `raw.csv_files` insert
- Upsert on `lot_external_id` prevents duplicates

**See:** 0009_lots_external_id.sql for schema
