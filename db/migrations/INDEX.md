# Database Migrations — Index & Registry

**Purpose:** Track all schema migrations in application order
**Registry File:** `_registry.json` (machine-readable)
**Convention:** Sequential numbering `00XX_description.sql`

---

## Migration Status

**Applied (Production-ready):**
- ✅ 0001_init.sql
- ✅ 0002_constraints.sql
- ✅ 0003_indexes.sql
- ✅ 0004_policy_flags.sql
- ❌ 0005_vin_normalized_fix.sql (SUPERSEDED — do not apply)
- ✅ 0006_vin_normalized_ck_uidx.sql
- ✅ 0007_canon_domains_columns.sql

**Planned (S1 — ETL Sprint):**
- 🔄 0008_etl_schemas.sql
- 🔄 0009_lots_external_id.sql
- 🔄 0010_audit_views.sql

---

## Migrations Detail

### 0001_init.sql
**Sprint:** S0 (Baseline)
**Purpose:** Create core tables (`vehicles`, `lots`, `sale_events`, `images`)
**Dependencies:** None
**Rollback:** NOT APPLICABLE (baseline, no destructive ops)
**Applied:** 2025-09-21 00:02

**Tables Created:**
- `vehicles(vin PK, make, model, year, ...)`
- `lots(id BIGSERIAL PK, vin FK, status, auction_datetime_utc, ...)`
- `sale_events(id BIGSERIAL PK, vin FK, lot_id FK, final_bid_usd, ...)`
- `images(id BIGSERIAL PK, vin FK, lot_id FK, storage_key, ...)`

---

### 0002_constraints.sql
**Sprint:** S0 (Baseline)
**Purpose:** Add PK/FK/CHECK constraints, VIN validation
**Dependencies:** 0001
**Rollback:** `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ...;`
**Applied:** 2025-09-21 00:02

**Constraints Added:**
- `vehicles.vin` — PRIMARY KEY
- `lots.vin` → `vehicles.vin` (FK, CASCADE)
- `sale_events.vin` → `vehicles.vin` (FK)
- `sale_events.lot_id` → `lots.id` (FK)
- `images.vin` → `vehicles.vin` (FK)
- VIN format CHECK: `vin ~ '^[A-HJ-NPR-Z0-9]{11,17}$'`
- Status domain CHECKs: `status IN ('active', 'sold', 'removed', ...)`

---

### 0003_indexes.sql
**Sprint:** S0 (Baseline)
**Purpose:** Read-path indexes for catalog & VIN card queries
**Dependencies:** 0002
**Rollback:** `DROP INDEX IF EXISTS ...;`
**Applied:** 2025-09-21 00:02

**Indexes Created:**
- `lots_status_auction_idx` — (status, auction_datetime_utc)
- `lots_vin_idx` — (vin)
- `sale_events_vin_date_idx` — (vin, sale_date)
- `images_vin_idx` — (vin)
- `images_lot_id_idx` — (lot_id)

---

### 0004_policy_flags.sql
**Sprint:** S0 (Soft Delete)
**Purpose:** Add `is_removed` boolean flags for soft deletes
**Dependencies:** 0003
**Rollback:** `DROP INDEX IF EXISTS ...; (columns removed in separate migration)`
**Applied:** 2025-09-23 05:24

**Changes:**
- `vehicles.is_removed BOOLEAN DEFAULT FALSE`
- `lots.is_removed BOOLEAN DEFAULT FALSE`
- `images.is_removed BOOLEAN DEFAULT FALSE`
- Partial indexes: `WHERE is_removed = FALSE`

---

### 0005_vin_normalized_fix.sql
**Sprint:** S0 (VIN Normalization — SUPERSEDED)
**Purpose:** Generated column for VIN normalization (write conflict issue)
**Dependencies:** 0004
**Status:** ❌ **DO NOT APPLY** (superseded by 0006)
**Applied:** N/A

**Issue:** Generated column caused write conflicts; replaced by 0006.

---

### 0006_vin_normalized_ck_uidx.sql
**Sprint:** S0 (VIN Normalization)
**Purpose:** Guarded CHECK + UNIQUE for `vehicles.vin_normalized` (generated column)
**Dependencies:** 0004
**Rollback:** `DROP INDEX IF EXISTS vehicles_vin_normalized_uidx; ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_normalized_format_ck;`
**Applied:** 2025-09-23 06:23

**Changes:**
- `vehicles.vin_normalized` — generated column (UPPER, no I/O/Q)
- `vehicles_vin_normalized_format_ck` — CHECK constraint
- `vehicles_vin_normalized_uidx` — UNIQUE index

---

### 0007_canon_domains_columns.sql
**Sprint:** S0 (Domain Expansion)
**Purpose:** Add domain-specific columns (title, damage, odometer, location)
**Dependencies:** 0006
**Rollback:** `ALTER TABLE ... DROP COLUMN IF EXISTS ...;`
**Applied:** 2025-09-23 (estimated)

**Columns Added:**
- `lots.title_type TEXT`
- `lots.damage_description TEXT`
- `lots.secondary_damage TEXT`
- `lots.odometer NUMERIC(10,1)`
- `lots.odometer_brand TEXT`
- `lots.location_city TEXT`
- `lots.location_state TEXT`
- `lots.location_country TEXT`

---

### 0008_etl_schemas.sql
**Sprint:** S1 — ETL A (CSV→PG)
**Purpose:** Create `raw`, `staging`, `audit` schemas for ETL pipeline
**Dependencies:** 0007
**Rollback:** `DROP SCHEMA IF EXISTS raw CASCADE; DROP SCHEMA IF EXISTS staging CASCADE; DROP SCHEMA IF EXISTS audit CASCADE;`
**Status:** 🔄 **PLANNED**

**Schemas to Create:**
- `raw` — immutable CSV files and rows (JSONB)
- `staging` — parsed CSV with extracted keys
- `audit` — metrics, conflict logs, ETL run history

**Tables:**
- `raw.csv_files(file_id UUID PK, path, sha256, bytes, headers_jsonb, ingested_at)`
- `raw.rows(id BIGSERIAL PK, file_id FK, row_no, payload_jsonb)`
- `staging.copart_raw(id BIGSERIAL PK, file_id FK, window_start_utc, lot_external_id, vin_raw, payload_jsonb, ingested_at)`
- `audit.vin_conflicts(id BIGSERIAL PK, vin_raw, vin_normalized, lot_external_id, conflict_reason, detected_at)`
- `audit.etl_runs(run_id UUID PK, file_id FK, status, rows_processed, errors, started_at, completed_at)`

**Extensions Required:**
- `pgcrypto` (for UUID generation)

---

### 0009_lots_external_id.sql
**Sprint:** S1 — ETL A (CSV→PG)
**Purpose:** Add Copart-specific external ID and source timestamp to `lots` table
**Dependencies:** 0008
**Rollback:** `DROP INDEX IF EXISTS idx_lots_external_id; ALTER TABLE lots DROP COLUMN IF EXISTS lot_external_id, DROP COLUMN IF EXISTS source_updated_at;`
**Status:** 🔄 **PLANNED**

**Columns to Add:**
- `lots.lot_external_id TEXT UNIQUE` — Copart's "Lot number" (upsert key)
- `lots.source_updated_at TIMESTAMPTZ` — CSV "Last Updated Time" for conflict resolution

**Indexes:**
- `idx_lots_external_id` — UNIQUE (lot_external_id)

**Upsert Strategy:**
```sql
INSERT INTO lots (lot_external_id, vin, ..., source_updated_at)
VALUES (?, ?, ..., ?)
ON CONFLICT (lot_external_id)
DO UPDATE SET
  vin = EXCLUDED.vin,
  ...,
  source_updated_at = EXCLUDED.source_updated_at,
  updated_at = now()
WHERE lots.source_updated_at IS NULL
   OR EXCLUDED.source_updated_at > lots.source_updated_at;
```

---

### 0010_audit_views.sql
**Sprint:** S1 — ETL A (CSV→PG)
**Purpose:** Create metric views for observability (`ingest_count`, `unknown_rate`, `parse_errors`)
**Dependencies:** 0009
**Rollback:** `DROP VIEW IF EXISTS audit.v_ingest_count, audit.v_unknown_rate, audit.v_parse_errors;`
**Status:** 🔄 **PLANNED**

**Views to Create:**
- `audit.v_ingest_count` — rows ingested per file/window
- `audit.v_unknown_rate` — % NULL/empty columns per file
- `audit.v_parse_errors` — malformed CSV rows (count, examples)

**Example:**
```sql
CREATE VIEW audit.v_ingest_count AS
SELECT
  f.file_id,
  f.path,
  COUNT(r.id) as row_count,
  f.ingested_at as file_ingested_at,
  MAX(r.id) as last_row_id
FROM raw.csv_files f
LEFT JOIN raw.rows r ON f.file_id = r.file_id
GROUP BY f.file_id, f.path, f.ingested_at;
```

---

## Application Protocol

**Manual Execution (S1):**
```bash
# Apply migration
psql $DATABASE_URL -f db/migrations/0008_etl_schemas.sql

# Verify
psql $DATABASE_URL -c "\dn raw"
psql $DATABASE_URL -c "\dt raw.*"
```

**Automated (S2+):**
- Use migration tool (e.g., `node-pg-migrate`, `Flyway`, or custom script)
- Check `_registry.json` for applied migrations
- Apply only new migrations in order

---

## Rollback Strategy

**Non-Destructive Policy:**
- Migrations MUST NOT drop tables or columns without explicit approval
- Use `IF NOT EXISTS` for CREATE operations
- Use `DROP ... IF EXISTS` for rollbacks

**Emergency Rollback:**
1. Identify migration to roll back from `_registry.json`
2. Execute rollback commands documented in migration header
3. Update `_registry.json` to mark as rolled back
4. Test on staging before applying to production

---

## Change Log

**2025-10-16 (S1 Kickoff):**
- Created INDEX.md migration registry
- Documented 0001-0007 (applied)
- Planned 0008-0010 for S1 ETL sprint

---

**Next Steps:**
1. Write `0008_etl_schemas.sql` DDL
2. Write `0009_lots_external_id.sql` DDL
3. Write `0010_audit_views.sql` DDL
4. Test on staging database
5. Update `_registry.json` after successful application
