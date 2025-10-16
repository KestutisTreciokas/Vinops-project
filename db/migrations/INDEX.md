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

**Applied (S1 — ETL Sprint):**
- ✅ 0008_etl_schemas.sql
- ✅ 0009_lots_external_id.sql
- ✅ 0010_audit_views.sql
- ✅ 0011_taxonomies.sql
- ✅ 0012_vehicles_upsert_proc.sql
- ✅ 0013_lots_upsert_proc.sql
- ✅ 0014_vin_validation_update.sql
- ✅ 0015_completion_detection.sql

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

### 0011_taxonomies.sql
**Sprint:** S1B — ETL (Domain Normalization)
**Purpose:** Create bilingual taxonomy lookup tables for RU/EN support
**Dependencies:** 0010
**Rollback:** `DROP SCHEMA IF EXISTS taxonomies CASCADE;`
**Applied:** 2025-10-16

**Changes:**
- Created `taxonomies` schema with 10 lookup tables
- Seeded 100+ bilingual codes (RU/EN)
- Created `get_taxonomy_label()` helper function
- Created `api.taxonomies_all` view for API consumption
- Created `audit.unknown_taxonomy_values` tracking table

**Taxonomy Tables:**
- `damage_types` (18 codes)
- `title_types` (11 codes)
- `statuses` (7 codes)
- `odometer_brands` (7 codes)
- `body_styles` (9 codes)
- `fuel_types` (8 codes)
- `transmission_types` (4 codes)
- `drive_types` (4 codes)
- `colors` (14 codes)
- `runs_drives_status` (3 codes)

---

### 0012_vehicles_upsert_proc.sql
**Sprint:** S1B — ETL (Core Upsert)
**Purpose:** Batch upsert procedure for vehicles table
**Dependencies:** 0011
**Rollback:** `DROP FUNCTION IF EXISTS upsert_vehicles_batch(UUID); DROP TABLE IF EXISTS audit.vehicle_conflicts;`
**Applied:** 2025-10-16

**Changes:**
- Added columns to vehicles table (trim, color, odometer_value, odometer_unit, odometer_brand)
- Created `upsert_vehicles_batch(UUID)` stored procedure
- Implements VIN validation and conflict resolution with COALESCE strategy
- Logs to `audit.etl_runs` table
- Created `audit.vehicle_conflicts` table for tracking

**Features:**
- Batch processing from staging.copart_raw
- DISTINCT ON VIN with latest window_start_utc
- ON CONFLICT DO UPDATE with timestamp check
- Returns inserted/updated/skipped counts

---

### 0013_lots_upsert_proc.sql
**Sprint:** S1B — ETL (Core Upsert)
**Purpose:** Batch upsert procedure for lots table with orphan prevention
**Dependencies:** 0012
**Rollback:** `DROP FUNCTION IF EXISTS upsert_lots_batch(UUID); DROP TABLE IF EXISTS audit.lot_conflicts;`
**Applied:** 2025-10-16

**Changes:**
- Added 30+ columns to lots table (lot_external_id, source_updated_at, yard_name, etc.)
- Created UNIQUE index on lot_external_id
- Created `upsert_lots_batch(UUID)` stored procedure
- Implements EXISTS check to prevent orphan lots
- Timestamp-based conflict resolution using source_updated_at
- Created `audit.lot_conflicts` table for tracking

**Features:**
- Prevents lots without vehicles (EXISTS check)
- Comprehensive field mapping from Copart CSV
- Status normalization (PURE SALE → active, SOLD → sold, etc.)
- Currency and numeric field parsing

---

### 0014_vin_validation_update.sql
**Sprint:** S1B — ETL Enhancement
**Purpose:** Comprehensive VIN validation supporting legacy formats
**Dependencies:** 0013
**Rollback:** Revert CHECK constraints and function
**Applied:** 2025-10-16

**Changes:**
- Created `is_valid_vin(TEXT)` function with comprehensive regex validation
- Supports standard 17-character VIN (ISO 3779)
- Supports EU Craft & Industrial Number (CIN) 14+hyphen format
- Supports US Hull Identification Number (HIN) 12-14 characters
- Supports legacy VIN (pre-1981) 3-17 characters
- Updated CHECK constraints on `vehicles` table to use new function
- Updated `upsert_vehicles_batch()` and `upsert_lots_batch()` procedures

**Impact:**
- Reduced skipped records from 625 to 11 (98.2% improvement)
- Added 612 legacy VIN vehicles (vintage cars, trailers, equipment)
- Final: 153,977 vehicles, 153,980 lots from run1.csv

**Rollback Commands:**
```sql
DROP FUNCTION IF EXISTS is_valid_vin(TEXT);
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_format_ck;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_normalized_format_ck;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_vin_format_ck CHECK (vin ~ '^[A-HJ-NPR-Z0-9]{11,17}$');
ALTER TABLE vehicles ADD CONSTRAINT vehicles_vin_normalized_format_ck CHECK (vin_normalized IS NULL OR vin_normalized ~ '^[A-HJ-NPR-Z0-9]{11,17}$');
```

---

### 0015_completion_detection.sql
**Sprint:** S1C — Completion Detection (Phase 1)
**Purpose:** Safe, passive detection of auction completions via CSV disappearance and VIN reappearance
**Dependencies:** 0014
**Rollback:** See rollback commands below
**Applied:** 2025-10-16

**Changes:**
- Added completion tracking columns to lots table
  - `final_bid_usd` - Final auction bid (populated via Phase 2 if enabled)
  - `sale_confirmed_at` - Timestamp when completion was detected
  - `detection_method` - Method used: csv_disappearance, vin_reappearance
  - `detection_notes` - Additional context about detection
- Expanded status domain: pending_result, not_sold, on_approval, cancelled
- Created `audit.completion_detections` table for logging detection runs
- Created `detect_disappeared_lots()` function - Find lots that disappeared from CSV
- Created `mark_lots_pending_result()` function - Mark disappeared lots
- Created `detect_vin_reappearances()` function - Find VINs that reappeared
- Created `mark_lots_not_sold_by_reappearance()` function - Mark previous as not_sold
- Created `run_completion_detection()` function - Complete detection workflow
- Created views: `audit.v_completion_stats`, `audit.v_pending_results`

**Detection Methods:**
1. **CSV Disappearance** (Risk: MINIMAL)
   - Compares consecutive CSV snapshots
   - Marks disappeared lots as "pending_result" after grace period
   - Accuracy: ~80% (can't determine if actually sold)

2. **VIN Reappearance** (Risk: MINIMAL)
   - Detects when same VIN appears with new lot_external_id
   - Retroactively marks previous lot as "not_sold"
   - Accuracy: ~95% for "not_sold" status

**Usage:**
```bash
# Run completion detection after CSV ingestion
node scripts/detect-completions.js

# Dry run (preview only)
node scripts/detect-completions.js --dry-run

# Custom grace period
node scripts/detect-completions.js --grace-period=2
```

**SQL Example:**
```sql
-- Manual detection between two CSV files
SELECT * FROM run_completion_detection(
  'prev-file-uuid'::UUID,
  'curr-file-uuid'::UUID,
  1.0  -- grace period in hours
);

-- View pending results
SELECT * FROM audit.v_pending_results;

-- View completion stats
SELECT * FROM audit.v_completion_stats;
```

**Rollback Commands:**
```sql
DROP FUNCTION IF EXISTS run_completion_detection(UUID, UUID, NUMERIC);
DROP FUNCTION IF EXISTS mark_lots_not_sold_by_reappearance(UUID);
DROP FUNCTION IF EXISTS detect_vin_reappearances(UUID);
DROP FUNCTION IF EXISTS mark_lots_pending_result(UUID, UUID, NUMERIC);
DROP FUNCTION IF EXISTS detect_disappeared_lots(UUID, UUID, NUMERIC);
DROP VIEW IF EXISTS audit.v_pending_results;
DROP VIEW IF EXISTS audit.v_completion_stats;
DROP TABLE IF EXISTS audit.completion_detections;
ALTER TABLE lots DROP COLUMN IF EXISTS detection_notes;
ALTER TABLE lots DROP COLUMN IF EXISTS detection_method;
ALTER TABLE lots DROP COLUMN IF EXISTS sale_confirmed_at;
ALTER TABLE lots DROP COLUMN IF EXISTS final_bid_usd;
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

**2025-10-16 (S1A Complete):**
- Created INDEX.md migration registry
- Documented 0001-0007 (applied)
- Planned 0008-0010 for S1 ETL sprint

**2025-10-16 (S1B Implementation):**
- Applied 0011_taxonomies.sql — 10 taxonomy tables with 100+ RU/EN codes
- Applied 0012_vehicles_upsert_proc.sql — Batch upsert procedure for vehicles
- Applied 0013_lots_upsert_proc.sql — Batch upsert procedure for lots
- Applied 0014_vin_validation_update.sql — Enhanced VIN validation (legacy, HIN, CIN support)
- Tested with run1.csv: 153,977 vehicles + 153,980 lots (including 612 legacy VINs)

**2025-10-16 (S1C Completion Detection — Phase 1):**
- Applied 0015_completion_detection.sql — Safe, passive completion detection
- Implemented CSV disappearance detection (0% ban risk, ~80% accuracy)
- Implemented VIN reappearance analysis (0% ban risk, ~95% accuracy for "not_sold")
- Created scripts/detect-completions.js for automated detection runs
- Created COMPLETION_DETECTOR_ANALYSIS.md with risk assessment and strategy
- Status tracking: pending_result, not_sold, on_approval statuses added

---

**Next Steps:**
1. Implement automated CSV fetching (cookie auth, 15-min scheduler)
2. Test completion detection with run2.csv (overlapping lots)
3. Evaluate Phase 2 (conservative scraping) after 2-4 weeks
4. S2: SSR/SEO implementation
