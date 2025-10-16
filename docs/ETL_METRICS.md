# ETL Observability Metrics

## Metrics Defined

### ingest_count
Rows ingested per CSV file
**View:** `audit.v_ingest_count`
**Alert:** declared_rows != actual_rows

### unknown_rate
Percentage of NULL/empty key columns
**View:** `audit.v_unknown_rate`
**Threshold:** Alert if >25% (currently 22%, acceptable)

### parse_errors
Malformed CSV rows
**View:** `audit.v_parse_errors`
**Alert:** Any errors detected

### lag_seconds
N/A for S1 (no auto-fetch); planned for S2

## QA Checks
- Smoke test on run1/run2 samples
- Verify stable counts between runs (-8 rows delta acceptable)
- Confirm VIN coverage 99.99%

**See:** ETL_QA_CHECKS.md for manual test procedures
