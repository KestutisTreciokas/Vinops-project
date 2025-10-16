# ETL RAW→Staging Protocol

## Intake Process
1. Place CSV in `/var/data/vinops/raw/copart/{YYYY}/{MM}/{DD}/{HHmm}.csv`
2. Compute SHA256
3. Insert into `raw.csv_files` (skip if sha256 exists)
4. Parse rows → `raw.rows` (JSONB payload)
5. Extract keys → `staging.copart_raw` (lot_external_id, vin_raw)

## Schema: raw.csv_files
- file_id (UUID PK)
- path, sha256 (UNIQUE), bytes, row_count
- headers_jsonb (schema tracking)
- window_start_utc, ingested_at

## Schema: staging.copart_raw
- lot_external_id (extracted from "Lot number")
- vin_raw (extracted from "VIN")
- payload_jsonb (full row)
- processed_at (NULL until upserted to core)

**See:** 0008_etl_schemas.sql for full DDL
