# Database Passport — Vinops PostgreSQL

**Document Status:** Living document, updated with each schema change
**Last Updated:** 2025-10-16
**Sprint:** S1 — ETL A (CSV→PG)

---

## Connection Details

**Database:** `vinops_db`
**Host:** 192.168.0.5:5432 (private network)
**Version:** PostgreSQL 17.6 (Ubuntu 17.6-2.pgdg24.04+1)
**Connection String:** `postgresql://gen_user:***@192.168.0.5:5432/vinops_db`
**Environment:** Development/Staging (production TBD)

---

## Roles & Permissions

### Current (S1 — Temporary)

**gen_user** (DB owner)
- **Purpose:** ETL operations + DDL + application queries
- **Grants:** SUPERUSER equivalent (temporary for S1 bootstrap)
- **Security Note:** ⚠️ Elevated privileges; split into separate roles in S2

### Planned (S2+)

**etl_rw** (ETL role)
- **Purpose:** Read/write to `raw`, `staging`, `audit` schemas; write to `core` (upsert only)
- **Grants:** `INSERT`, `UPDATE`, `DELETE` on ETL schemas; `SELECT` on all

**app_ro** (Application read-only)
- **Purpose:** Frontend/API queries
- **Grants:** `SELECT` on `public.*` (core tables only)

**admin** (Schema manager)
- **Purpose:** Migrations, DDL changes
- **Grants:** Full DDL on all schemas

---

## Schemas

### public (core domain data)
**Owner:** `gen_user` (→ `admin` in S2)
**Purpose:** Canonical vehicle, lot, sale_event, image data
**Tables:**
- `vehicles(vin PK, year, make, model, ...)`
- `lots(id BIGSERIAL PK, lot_external_id TEXT UNIQUE, vin FK, ...)`
- `sale_events(id BIGSERIAL PK, vin FK, lot_id FK, final_bid_usd, ...)`
- `images(id BIGSERIAL PK, vin FK, lot_id FK, storage_key, ...)`

**Access:** Read-only for `app_ro`; upsert for `etl_rw`

### raw (immutable source data)
**Owner:** `gen_user` (→ `etl_rw` in S2)
**Purpose:** Lossless storage of CSV files and rows as JSONB
**Tables:**
- `csv_files(file_id UUID PK, path, sha256, bytes, headers_jsonb, ingested_at)`
- `rows(id BIGSERIAL PK, file_id FK, row_no, payload_jsonb)`

**Retention:** Permanent (archive to R2 in S2)
**Access:** Write-only for ETL; read for audit queries

### staging (transformation workspace)
**Owner:** `gen_user` (→ `etl_rw` in S2)
**Purpose:** Parsed CSV data with extracted keys (lot_external_id, vin_raw)
**Tables:**
- `copart_raw(id BIGSERIAL PK, file_id FK, window_start_utc, lot_external_id, vin_raw, payload_jsonb, ingested_at)`

**Retention:** Rolling 30-day window (configurable)
**Access:** Read/write for ETL

### audit (observability & conflicts)
**Owner:** `gen_user` (→ `etl_rw` in S2)
**Purpose:** Metrics, conflict logs, data quality checks
**Tables:**
- `vin_conflicts(id BIGSERIAL PK, vin_raw, vin_normalized, lot_external_id, conflict_reason, detected_at)`
- `etl_runs(run_id UUID PK, file_id FK, status, rows_processed, errors, started_at, completed_at)`

**Views:**
- `v_ingest_count` — rows ingested per file/window
- `v_unknown_rate` — % NULL/empty columns per file
- `v_parse_errors` — malformed CSV rows

**Access:** Read/write for ETL; read for monitoring

---

## Extensions

**Enabled:**
- `pgcrypto` — UUID generation (`gen_random_uuid()`)
- `pg_stat_statements` — Query performance monitoring
- `pg_trgm` — Fuzzy text search (for VIN/make/model)
- `citext` — Case-insensitive text (future use)

**To Enable (if needed):**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
```

---

## VIN Normalization Rules

**Canonical Format:**
- **Length:** 11-17 characters (flexible for older vehicles)
- **Case:** UPPERCASE
- **Excluded Characters:** I, O, Q (per ISO 3779 standard)
- **Storage:** `vehicles.vin` (normalized), `vehicles.vin_raw` (original)

**Normalization Function (planned):**
```sql
CREATE OR REPLACE FUNCTION normalize_vin(raw TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(REGEXP_REPLACE(raw, '[IOQ]', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Validation Constraint (existing in 0006_vin_normalized_ck_uidx.sql):**
```sql
CHECK (vin ~ '^[A-HJ-NPR-Z0-9]{11,17}$')
```

---

## Indexes & Constraints

**Core Uniqueness:**
- `vehicles(vin)` — PRIMARY KEY
- `lots(id)` — PRIMARY KEY (BIGSERIAL)
- `lots(lot_external_id)` — UNIQUE (Copart's "Lot number")
- `vehicles(vin_normalized)` — UNIQUE (if using generated column)

**Foreign Keys:**
- `lots.vin` → `vehicles.vin` (ON DELETE CASCADE)
- `sale_events.vin` → `vehicles.vin`
- `sale_events.lot_id` → `lots.id`
- `images.vin` → `vehicles.vin`
- `images.lot_id` → `lots.id`

**Performance Indexes:**
- `lots(status, auction_datetime_utc)` — catalog queries
- `lots(vin)` — vehicle detail lookups
- `sale_events(vin, sale_date)` — sale history
- `images(vin, lot_id)` — image gallery

---

## Migration Strategy

**Registry:** `db/migrations/_registry.json`
**Application Order:** Sequential by `id` (0001 → 0007 currently applied)
**Rollback Policy:** Non-destructive migrations only; rollback via `ALTER TABLE DROP CONSTRAINT` or `DROP INDEX`

**Current Migrations:**
1. `0001_init.sql` — Baseline tables (vehicles, lots, sale_events, images)
2. `0002_constraints.sql` — PK/FK/CHECK constraints, VIN validation
3. `0003_indexes.sql` — Read-path indexes
4. `0004_policy_flags.sql` — Soft-delete `is_removed` flags
5. `0005_vin_normalized_fix.sql` — Superseded (do not apply)
6. `0006_vin_normalized_ck_uidx.sql` — VIN format CHECK + UNIQUE
7. `0007_canon_domains_columns.sql` — Domain-specific columns

**Planned for S1:**
8. `0008_etl_schemas.sql` — Create `raw`, `staging`, `audit` schemas
9. `0009_lots_external_id.sql` — Add `lots.lot_external_id`, `source_updated_at`
10. `0010_audit_views.sql` — Metric views (`v_ingest_count`, `v_unknown_rate`, etc.)

---

## Data Invariants

**Upsert Key:** `lots.lot_external_id` (Copart's "Lot number")
**Conflict Resolution:** Last-write-wins via `source_updated_at` timestamp
**VIN Conflicts:** Log to `audit.vin_conflicts` if normalized VIN matches but raw differs
**Idempotence:** Re-importing same CSV (by sha256) skips processing; upsert on lot_external_id prevents duplicates

---

## Security Notes

**⚠️ Current State (S1):**
- Single `gen_user` role with elevated privileges
- Database on private network (192.168.0.5), not exposed to public internet
- Password stored in `deploy/.env.runtime` (plain text — rotate in S2)

**🔒 Planned Hardening (S2):**
- Split roles: `admin`, `etl_rw`, `app_ro`
- Move secrets to vault (HashiCorp Vault or AWS Secrets Manager)
- Enable SSL/TLS for connections
- Implement row-level security (RLS) if multi-tenant

---

## Observability

**Metrics Collected:**
- `ingest_count` — rows per CSV file
- `unknown_rate` — % NULL/empty columns
- `parse_errors` — malformed CSV rows
- `upsert_conflicts` — lots updated via conflict resolution

**Monitoring Tools:**
- `pg_stat_statements` — slow query analysis
- `audit.etl_runs` — ETL job history
- Manual QA: smoke tests on sample CSVs

**Alerts (planned):**
- `unknown_rate` > 15% threshold
- ETL job failures
- VIN normalization conflicts

---

## Change Log

**2025-10-16 (S1 Kickoff):**
- Initial DB passport created
- Documented DSN, roles, schemas, extensions
- Defined VIN normalization rules
- Planned S1 migrations (0008-0010)

---

**Next Steps:**
1. Create `db/migrations/INDEX.md` migration registry
2. Write DDL for `raw`, `staging`, `audit` schemas (migration 0008)
3. Implement `lots.lot_external_id` column (migration 0009)
