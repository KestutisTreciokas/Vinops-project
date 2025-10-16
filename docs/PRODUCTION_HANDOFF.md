# Production Handoff — S1 ETL A (CSV→PG)

**Sprint:** S1 — ETL A (CSV→PG)
**Status:** ✅ **READY FOR PRODUCTION**
**Handoff Date:** 2025-10-16
**Team:** Development → Operations

---

## Executive Summary

The S1 ETL Sprint has successfully delivered a production-ready Copart CSV ingestion pipeline with comprehensive documentation, database schema, and tested code. All acceptance criteria have been met with zero critical issues.

**Key Achievements:**
- ✅ 153,991 rows ingested from run1.csv sample (zero errors)
- ✅ Complete RAW→Staging pipeline operational
- ✅ Audit metrics validated (unknown_rate 0.01%, parse_errors 0)
- ✅ Idempotence confirmed (SHA256 duplicate prevention)
- ✅ 13 documentation files + 3 database migrations delivered

---

## Deployment Checklist

### Pre-Deployment

- [x] All migrations tested on staging database
- [x] VIN normalization function created and tested
- [x] ETL ingestion script tested with 150K+ row sample
- [x] Audit views validated
- [ ] **TODO:** Review database credentials security (rotate password)
- [ ] **TODO:** Configure backup schedule for raw.* schemas
- [ ] **TODO:** Set up monitoring alerts (see Observability section)

### Deployment Steps

**1. Database Migrations (Apply in Order):**
```bash
# Baseline (if not already applied)
psql $DATABASE_URL -f db/migrations/0001_init.sql
psql $DATABASE_URL -f db/migrations/0002_constraints.sql
psql $DATABASE_URL -f db/migrations/0003_indexes.sql
psql $DATABASE_URL -f db/migrations/0004_policy_flags.sql
psql $DATABASE_URL -f db/migrations/0006_vin_normalized_ck_uidx.sql
psql $DATABASE_URL -f db/migrations/0007_canon_domains_columns.sql

# S1 ETL Schemas
psql $DATABASE_URL -f db/migrations/0008_etl_schemas.sql
psql $DATABASE_URL -f db/migrations/0009_lots_external_id.sql
psql $DATABASE_URL -f db/migrations/0010_audit_views.sql
```

**2. VIN Normalization Function:**
```sql
-- Already created in 0008, but verify:
SELECT normalize_vin('TEST1234567890VIN') IS NOT NULL AS function_exists;
```

**3. Directory Structure:**
```bash
mkdir -p /var/data/vinops/raw/copart/{2025,2024}/{01..12}/{01..31}
chown -R etl_user:etl_group /var/data/vinops/raw  # Adjust user/group as needed
```

**4. Install Dependencies:**
```bash
cd /root/Vinops-project
npm install  # Installs csv-parser, pg, dotenv
```

**5. Configure Environment:**
```bash
# Ensure deploy/.env.runtime contains:
DATABASE_URL=postgresql://gen_user:***@192.168.0.5:5432/vinops_db
```

**6. Test Ingestion:**
```bash
# Dry-run with sample
node scripts/ingest-copart-csv.js /path/to/test/sample.csv

# Verify in database
psql $DATABASE_URL -c "SELECT * FROM audit.v_ingest_count;"
```

---

## Production Usage

### Manual Ingestion (S1)

**Command:**
```bash
node scripts/ingest-copart-csv.js /var/data/vinops/raw/copart/YYYY/MM/DD/HHmm.csv
```

**Example:**
```bash
# Ingest 15-minute window CSV
node scripts/ingest-copart-csv.js /var/data/vinops/raw/copart/2025/10/16/1430.csv
```

**Expected Output:**
```
============================================================
  Copart CSV Ingestion — S1 ETL
============================================================

Source: /var/data/vinops/raw/copart/2025/10/16/1430.csv
✓ Connected to database

SHA256: abc123...
Bytes: 95,972,917

Parsed 153,991 rows
Headers: 59 columns

✓ Inserted into raw.csv_files (file_id: ...)
Inserting rows into raw.rows...
  Inserted: 153,991 / 153,991
✓ All rows inserted into raw.rows

Extracting keys into staging.copart_raw...
✓ Inserted 153,991 rows into staging.copart_raw

============================================================
  Ingestion Summary
============================================================
Total rows: 153,991
Missing Lot ID: 0 (0.00%)
Missing VIN: 8 (0.01%)

✅ Ingestion complete!
```

### Idempotence Behavior

**Re-running same file:**
```
⚠️  File already ingested (file_id: 28e3e071-5c48-4047-87d2-88a4db94e5cf)
Skipping ingestion (idempotent).
```

---

## Observability

### Monitoring Queries

**1. Ingestion Health Check:**
```sql
SELECT
  file_id,
  path,
  declared_rows,
  actual_rows,
  ingested_at
FROM audit.v_ingest_count
ORDER BY ingested_at DESC
LIMIT 10;
```

**2. Data Quality Check:**
```sql
SELECT
  file_id,
  ROUND(vin_null_pct::numeric, 2) as vin_null_pct,
  ROUND(lot_null_pct::numeric, 2) as lot_null_pct,
  total_rows
FROM audit.v_unknown_rate
WHERE vin_null_pct > 1.0 OR lot_null_pct > 1.0;  -- Alert threshold
```

**3. Parse Errors:**
```sql
SELECT * FROM audit.v_parse_errors WHERE error_count > 0;
```

**4. Recent Files:**
```sql
SELECT
  file_id,
  path,
  row_count,
  ROUND(bytes / 1024.0 / 1024.0, 2) as mb,
  ingested_at
FROM raw.csv_files
ORDER BY ingested_at DESC
LIMIT 20;
```

### Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| unknown_rate (VIN) | > 25% | Investigate schema changes |
| parse_errors | > 0 | Review error messages, check CSV format |
| ingestion_time | > 5 minutes | Check database performance, network |
| duplicate_sha256 | N/A | Normal (idempotent), log for tracking |

### Grafana Dashboards (Recommended for S2)

**Metrics to Track:**
- Ingestion throughput (rows/second)
- File size trends (MB over time)
- Unknown rate percentage
- Parse error rate
- Ingestion lag (if automated in S2)

---

## Database Schema

### Key Tables

**raw.csv_files:**
- Purpose: File registry with SHA256 integrity
- Retention: Permanent
- Size estimate: ~500 bytes/file

**raw.rows:**
- Purpose: Lossless JSONB storage of all CSV rows
- Retention: Permanent (archive to R2 in S2)
- Size estimate: ~600 bytes/row → ~92 MB per 153K-row file

**staging.copart_raw:**
- Purpose: Extracted keys (lot_external_id, vin_raw) for upsert
- Retention: Rolling 30-day window (configurable)
- Size estimate: ~400 bytes/row

**audit.*** tables:**
- Purpose: Conflict logs, ETL runs, VIN conflicts
- Retention: 90 days (configurable)

### Indexes

**Performance-critical indexes:**
```sql
-- raw.rows
CREATE INDEX idx_rows_lot_number ON raw.rows((payload_jsonb->>'Lot number'));
CREATE INDEX idx_rows_vin ON raw.rows((payload_jsonb->>'VIN'));

-- staging.copart_raw
CREATE INDEX idx_staging_lot ON staging.copart_raw(lot_external_id);
CREATE INDEX idx_staging_vin ON staging.copart_raw(vin_raw);
```

**Monitor index usage:**
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname IN ('raw', 'staging', 'audit')
ORDER BY idx_scan DESC;
```

---

## Known Issues & Limitations

### S1 Scope Limitations

**1. Manual CSV Fetching (Out of Scope)**
- CSV files must be downloaded manually via Copart Member login
- Automation deferred to S2 (requires cookie/UA/Referer handling)

**2. Core Upsert Not Implemented**
- Data ingested into `staging.copart_raw` only
- Upsert to `public.lots` and `public.vehicles` deferred to S2

**3. Single Database Role**
- `gen_user` has elevated privileges (temporary for S1)
- Role split (`etl_rw`, `app_ro`) planned for S2

**4. Local RAW Storage**
- Files stored on local filesystem (`/var/data/vinops/raw/`)
- Migration to R2 object storage planned for S2

### Known Data Issues

**1. Missing VINs (0.01%)**
- 8 rows out of 153,991 have NULL/empty VIN
- Behavior: Lot retained in staging, vehicle upsert skipped (S2)

**2. High Bid "0" Values**
- Many rows have `High Bid = 0.0` (no bids yet)
- Interpretation: Treat as NULL/unknown for analytics

**3. Timestamp Format Inconsistency**
- "Last Updated Time": ISO 8601 ✅
- "Create Date/Time": Non-standard format (needs custom parser in S2)

---

## Security Considerations

### Current State (S1)

**⚠️ Security Gaps (Address in Production):**

1. **Database Credentials:**
   - Password stored in plain text (`deploy/.env.runtime`)
   - **Action:** Move to vault (HashiCorp Vault / AWS Secrets Manager)
   - **Priority:** HIGH

2. **Single Elevated Role:**
   - `gen_user` has SUPERUSER equivalent privileges
   - **Action:** Split into `admin`, `etl_rw`, `app_ro` roles (S2)
   - **Priority:** MEDIUM

3. **No SSL/TLS:**
   - Database connection over private network (192.168.0.5)
   - **Action:** Enable SSL for connections in production
   - **Priority:** MEDIUM

4. **Audit Log Retention:**
   - No automated cleanup for audit tables
   - **Action:** Implement 90-day retention policy
   - **Priority:** LOW

### Secure Deployment Recommendations

**1. Rotate Database Password:**
```bash
# Generate new password
openssl rand -base64 32

# Update in PostgreSQL
ALTER USER gen_user WITH PASSWORD 'new_secure_password';

# Update in vault (not in git!)
```

**2. Restrict File Permissions:**
```bash
chmod 600 deploy/.env.runtime
chown etl_user:etl_group deploy/.env.runtime
```

**3. Network Isolation:**
- Ensure database (192.168.0.5) not exposed to public internet
- Use VPN/bastion host for remote access

---

## Rollback Plan

### If Issues Arise Post-Deployment

**1. Rollback Migrations (Nuclear Option):**
```sql
-- Rollback S1 migrations (DESTRUCTIVE - loses all ingested data!)
DROP SCHEMA IF EXISTS raw CASCADE;
DROP SCHEMA IF EXISTS staging CASCADE;
DROP SCHEMA IF EXISTS audit CASCADE;
ALTER TABLE public.lots DROP COLUMN IF EXISTS lot_external_id;
ALTER TABLE public.lots DROP COLUMN IF EXISTS source_updated_at;
```

**2. Disable Ingestion (Safe):**
```bash
# Rename script to prevent execution
mv scripts/ingest-copart-csv.js scripts/ingest-copart-csv.js.disabled
```

**3. Data Recovery:**
- All raw data retained in `raw.csv_files` and `raw.rows`
- Re-run staging extraction: `INSERT INTO staging.copart_raw SELECT ... FROM raw.rows`

---

## Performance Benchmarks

**Test Environment:**
- PostgreSQL 17.6 on 192.168.0.5
- CSV: 96 MB, 153,991 rows, 59 columns

**Results:**
- **Total ingestion time:** 40 seconds
- **Throughput:** 3,850 rows/second
- **Database size impact:** ~92 MB (raw.rows JSONB storage)

**Expected Production Performance:**
- 15-minute window (~150K rows): ~40-60 seconds
- Daily volume (32 windows): ~32-64 minutes total
- Disk growth: ~3 GB/day (raw.rows) → ~90 GB/month

**Scaling Considerations:**
- Increase batch size for faster ingestion (test 5,000-10,000 rows/batch)
- Archive old raw.rows to R2 after 30 days
- Implement partitioning on `raw.rows` by `ingested_at` (month-based)

---

## Support & Troubleshooting

### Common Issues

**Issue 1: "File already ingested" on new file**
- **Cause:** SHA256 collision (extremely rare) or incorrect file path
- **Solution:** Verify file is actually new; check `raw.csv_files` table

**Issue 2: Connection timeout**
- **Cause:** Database unreachable or overloaded
- **Solution:** Check network, verify database is running, review `pg_stat_activity`

**Issue 3: Out of memory during ingestion**
- **Cause:** Large CSV file (>500K rows)
- **Solution:** Reduce batch size in script (`batchSize = 500`)

### Debug Mode

**Enable verbose logging:**
```bash
DEBUG=* node scripts/ingest-copart-csv.js /path/to/file.csv
```

**Check database logs:**
```bash
tail -f /var/log/postgresql/postgresql-17-main.log  # Adjust path
```

---

## Next Steps (S2 Scope)

### High Priority

1. **Core Upsert Implementation:**
   - Implement `staging.copart_raw` → `public.lots` upsert
   - Handle VIN conflicts (audit logging)
   - Test with run2.csv (verify last-write-wins)

2. **Role Split:**
   - Create `etl_rw` role (limited to ETL schemas)
   - Create `app_ro` role (read-only for application)
   - Migrate `gen_user` scripts to `etl_rw`

3. **Automated CSV Fetching:**
   - Implement cookie-based authentication
   - Handle UA/Referer requirements
   - Schedule 15-minute interval fetches

### Medium Priority

4. **R2 Migration:**
   - Move RAW files to object storage
   - Implement archival strategy (>30 days)

5. **Monitoring:**
   - Set up Grafana dashboards
   - Configure alerting (email/Slack)

6. **Testing:**
   - Unit tests for VIN normalization
   - Integration tests for upsert logic

---

## Documentation Index

**Planning & Design:**
- `docs/DB_PASSPORT.md` — Database architecture
- `db/migrations/INDEX.md` — Migration registry
- `docs/CSV_SCHEMA_DISCOVERED.md` — Column analysis
- `docs/CSV_HEADER_MAP.md` — Name mappings

**ETL Pipeline:**
- `docs/ETL_RAW_STAGING.md` — Intake protocol
- `docs/ETL_UPSERT_RULES.md` — Conflict resolution
- `docs/ETL_METRICS.md` — Observability metrics
- `docs/ETL_QA_CHECKS.md` — Quality assurance

**Implementation:**
- `docs/S1_IMPLEMENTATION_SUMMARY.md` — Test results
- `docs/PRODUCTION_HANDOFF.md` — This document
- `scripts/ingest-copart-csv.js` — Ingestion script

---

## Sign-Off

**Development Team:**
- ✅ All acceptance criteria met
- ✅ Code tested and validated
- ✅ Documentation complete
- ✅ Ready for production deployment

**Operations Team (To Complete):**
- [ ] Migrations applied to production database
- [ ] Environment configured (`/var/data/vinops/raw/`)
- [ ] Monitoring dashboards set up
- [ ] Alert thresholds configured
- [ ] Backup schedule verified
- [ ] Security review completed

**Approval Required From:**
- [ ] Tech Lead (code review)
- [ ] Database Admin (schema review)
- [ ] Security Team (credential rotation)
- [ ] Product Owner (acceptance testing)

---

**Handoff Date:** 2025-10-16
**Next Review:** S2 Planning (Core Upsert Sprint)
**Contact:** Development Team (via GitHub Issues)

**Status:** ✅ **READY FOR PRODUCTION DEPLOYMENT**
