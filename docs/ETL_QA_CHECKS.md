# ETL QA Smoke Tests

## Manual Test: run1.csv
1. Load run1.csv into RAW
2. Verify `raw.csv_files` entry (sha256, row_count=153991)
3. Check `audit.v_ingest_count`: actual_rows=153991
4. Check `audit.v_unknown_rate`: vin_null_pct ≈ 0.01%
5. Check `audit.v_parse_errors`: error_count=0

## Manual Test: run2.csv
1. Load run2.csv into RAW
2. Verify row_count=153983 (-8 delta acceptable)
3. Confirm no parse errors
4. Verify upsert updates existing lots (source_updated_at comparison)

## Acceptance Criteria
✓ 153K+ rows ingested
✓ Unknown_rate ≤ 25%
✓ Zero parse errors
✓ Upsert idempotence verified (re-run same CSV → no duplicates)

**Status:** MS-S1-06 pending implementation
