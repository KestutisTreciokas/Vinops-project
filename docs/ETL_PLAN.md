# ETL Plan — S1B: Automated Ingestion & Core Upsert

**Sprint:** S1B — ETL ingest & normalization (CSV ~15 min → RAW → validation/mapping → upsert by `lot_id`)
**Date:** 2025-10-16
**Mode:** Planning (no code edits yet)
**Status:** 📋 PLANNING

---

## Executive Summary

**Objective:** Complete the ETL pipeline by adding automated CSV fetching (every ~15 minutes), core upsert logic (staging → public tables), RU/EN taxonomies, VIN deduplication, and completion detection (PENDING_RESULT after auction + disappearance).

**Current State (S1A Complete):**
- ✅ Manual CSV ingestion: `node scripts/ingest-copart-csv.js <path>`
- ✅ RAW→Staging pipeline operational (153,991 rows ingested)
- ✅ SHA256 idempotency
- ✅ Audit metrics: unknown_rate 0.01%, parse_errors 0

**Gap:**
- ❌ Automated CSV downloading every ~15 minutes
- ❌ Core upsert (staging.copart_raw → public.lots/vehicles)
- ❌ VIN deduplication (update if VIN exists)
- ❌ RU/EN taxonomies for user-facing values
- ❌ Completion detector (PENDING_RESULT status)

---

## Requirements & Invariants

### Functional Requirements

**FR-01: Automated CSV Fetching**
- Frequency: Every ~15 minutes
- Method: Cookie-based authentication to Copart Member area
- URL: `https://inventory.copart.io/FTPLSTDM/salesdata.cgi?authKey=YPYU91EI`
- Requirements: Fixed UA, Referer header
- Storage: `/var/data/vinops/raw/copart/YYYY/MM/DD/HHmm.csv`
- Trigger: Automatic ingestion after successful download

**FR-02: Core Upsert by lot_id**
- Primary key: `lots.lot_external_id` (Copart's "Lot number")
- Conflict resolution: Last-write-wins via `source_updated_at` timestamp
- Tables: `staging.copart_raw` → `public.vehicles` + `public.lots`
- VIN handling: If VIN exists → update vehicle in place (no duplicates)

**FR-03: VIN Deduplication**
- Rule: If fresh CSV contains a VIN that already exists → UPDATE (not INSERT)
- Conflict key: `vehicles.vin` (normalized)
- Update strategy: Overwrite all fields if `source_updated_at` is newer
- Preserve: Historical `sale_events` remain linked to original VIN

**FR-04: RU/EN Taxonomies**
- Domains: damage types, title types, status, odometer brand, colors, body styles, fuel types
- Storage: Lookup tables with `en` and `ru` columns
- Mapping: CSV raw value → EN code → display label (EN/RU)
- Example: "WATER/FLOOD" → `damage_flood` → {"en": "Water/Flood Damage", "ru": "Повреждение водой/наводнением"}`

**FR-05: Completion Detector**
- Logic: After `auction_datetime_utc` + disappearance from CSV → set `status = 'PENDING_RESULT'`
- Detection: Compare current CSV VIN list with previous window
- Grace period: 2 hours post-auction (allow for late updates)
- Transition: PENDING_RESULT → SOLD/NO_SALE (via sales finalizer in future sprint)

### Non-Functional Requirements

**NFR-01: Performance**
- Target: Ingest 150K+ rows in <60 seconds
- Batch size: 1000 rows per INSERT
- Throughput: ≥2,500 rows/second

**NFR-02: Reliability**
- Idempotency: Re-running same window (SHA256 check) → skip gracefully
- Retry logic: Network failures → 3 retries with exponential backoff
- Circuit breaker: After 5 consecutive failures → alert + disable auto-fetch

**NFR-03: Observability**
- Metrics: ingest_count, unknown_rate, parse_errors, upsert_conflicts, fetch_failures
- Logging: Structured JSON logs (timestamp, level, context, duration)
- Alerts: unknown_rate >25%, parse_errors >0, fetch_failures >3 consecutive

### Technical Constraints

**TC-01: 15-Minute Windows**
- CSV updates every ~15 minutes (not guaranteed exact)
- Scheduler: Systemd timer or cron (OnCalendar=*:00/15)
- Overlap handling: Lock file prevents concurrent runs

**TC-02: Idempotent Upsert**
- No duplicates: Each `lot_external_id` appears once in `public.lots`
- No orphans: Every lot must reference valid `vehicles.vin`
- Referential integrity: Foreign keys cascade updates, restrict deletes

**TC-03: Security**
- Credentials: Copart username/password in vault (not .env.runtime)
- Session tokens: Cookie refresh every 24 hours (preemptive)
- Rate limiting: Max 1 request per 15 minutes to avoid blocking

---

## Work Breakdown — Mini-Sprints

### MS-S1B-01: Automated CSV Fetching

**Objective:** Replace manual CSV download with automated 15-minute scheduler

**Inputs:**
- Copart Member credentials (username/password)
- Session management strategy (cookie refresh)
- UA/Referer requirements from S1 CSV diagnostic

**Outputs:**
- `scripts/fetch-copart-csv.js` — Automated CSV downloader
- `docs/COPART_AUTH_FLOW.md` — Authentication/session handling
- Systemd timer: `/etc/systemd/system/copart-etl.timer`
- Lock file mechanism: `/var/run/copart-etl.lock`

**Tasks:**
1. Implement cookie-based login flow (POST to login endpoint)
2. Store session cookie securely (expires after 24h)
3. Fetch CSV with UA/Referer headers
4. Save to timestamped path: `/var/data/vinops/raw/copart/YYYY/MM/DD/HHmm.csv`
5. Trigger ingestion script on success
6. Handle errors: network timeout, auth failure, rate limit

**Acceptance Criteria:**
- [ ] Script successfully downloads CSV every 15 minutes
- [ ] Session cookie refreshes automatically before expiration
- [ ] Lock file prevents overlapping runs
- [ ] Errors logged with context (timestamp, HTTP status, body snippet)
- [ ] After 3 consecutive failures → alert triggered

**Risks:**
- Cookie expiration → session invalid → manual re-login
- IP blocking → rate limit exceeded
- CSV URL change → hardcoded URL breaks

**Rollback:**
- Disable systemd timer: `systemctl stop copart-etl.timer`
- Revert to manual CSV download

**DoD:**
- [ ] 4 consecutive successful fetches (1 hour window)
- [ ] No manual intervention required
- [ ] Logs show session refresh every 24h

---

### MS-S1B-02: CSV Domain Normalization

**Objective:** Create handler to normalize raw CSV values for user display

**Inputs:**
- CSV raw values (damage types, statuses, title types, etc.)
- EN/RU translations for taxonomies
- CSV_HEADER_MAP.md column mappings

**Outputs:**
- `docs/CSV_DOMAIN.md` — Normalization rules and transformations
- `db/migrations/0011_taxonomies.sql` — Lookup tables for EN/RU
- `scripts/lib/csv-normalizer.js` — Reusable normalization functions

**Tasks:**
1. Analyze unique values for taxonomy domains (damage, status, title, etc.)
2. Create lookup tables: `taxonomies.damage_types`, `taxonomies.title_types`, `taxonomies.statuses`
3. Schema: `(code TEXT PRIMARY KEY, en TEXT, ru TEXT, category TEXT)`
4. Seed initial translations (EN priority; RU via Google Translate + manual review)
5. Implement normalization functions:
   - `normalizeDamage(raw)` → code
   - `normalizeStatus(raw)` → code
   - `normalizeTitleType(raw)` → code
6. Handle unknowns: Unmapped values → store as-is, log for review

**Acceptance Criteria:**
- [ ] All taxonomy domains have lookup tables (damage, status, title, odometer_brand, color, body, fuel)
- [ ] EN translations for 100% of observed values
- [ ] RU translations for ≥80% of common values (placeholder "TODO" for rare ones)
- [ ] Normalizer returns code (not raw CSV string)
- [ ] Unknown values logged to `audit.unknown_taxonomy_values` table

**Risks:**
- New CSV values → mapping not found → display raw value
- Translation quality → Google Translate errors

**Rollback:**
- Revert migration 0011
- Use raw CSV values (degraded UX, no multi-language)

**DoD:**
- [ ] 10 test cases pass (including unknowns)
- [ ] RU translations reviewed by native speaker
- [ ] Unknown values rate <5% for damage/status/title

---

### MS-S1B-03: Core Upsert — Vehicles Table

**Objective:** Implement upsert logic for `staging.copart_raw` → `public.vehicles`

**Inputs:**
- Staging data: `staging.copart_raw.vin_raw`, make, model, year, etc.
- VIN normalization function: `normalize_vin()`
- Conflict resolution: Last-write-wins via `source_updated_at`

**Outputs:**
- `db/migrations/0012_vehicles_upsert_proc.sql` — Stored procedure for batch upsert
- `scripts/upsert-vehicles.js` — Node.js wrapper for procedure
- `docs/UPSERT_VEHICLES_LOGIC.md` — Decision tree and edge cases

**Tasks:**
1. Create stored procedure: `upsert_vehicles_batch(staging_file_id UUID)`
2. Logic:
   ```sql
   INSERT INTO vehicles (vin, year, make, model, trim, body, fuel, transmission, drive, engine, color, odometer_value, odometer_unit, odometer_brand)
   SELECT
     normalize_vin(vin_raw),
     payload_jsonb->>'Year',
     payload_jsonb->>'Make',
     ...
   FROM staging.copart_raw
   WHERE file_id = staging_file_id
     AND vin_raw IS NOT NULL
   ON CONFLICT (vin)
   DO UPDATE SET
     year = EXCLUDED.year,
     make = EXCLUDED.make,
     ...
     updated_at = now()
   WHERE vehicles.updated_at < EXCLUDED.updated_at;
   ```
3. Handle NULLs: Empty strings → NULL (not '')
4. Type casting: Year (INTEGER), Odometer (NUMERIC)
5. Validation: Year BETWEEN 1900 AND 2100
6. Audit logging: Record conflicts in `audit.vehicle_conflicts`

**Acceptance Criteria:**
- [ ] Batch upsert processes 150K rows in <30 seconds
- [ ] No duplicate VINs in `vehicles` table
- [ ] Existing VINs updated (not duplicated)
- [ ] Audit log captures all conflicts (old vs new values)
- [ ] NULL handling: Empty strings converted to NULL

**Risks:**
- Performance: Large batch → timeout
- Conflicts: Concurrent updates → deadlock

**Rollback:**
- Delete from `vehicles` WHERE `updated_at` > rollback_timestamp
- Restore from `audit.vehicle_conflicts` (old values)

**DoD:**
- [ ] run1.csv (153,991 rows) upserts successfully
- [ ] run2.csv (overlap with run1) → updates existing, no duplicates
- [ ] Audit log shows ≥10 conflicts (expected for overlapping CSVs)

---

### MS-S1B-04: Core Upsert — Lots Table

**Objective:** Implement upsert logic for `staging.copart_raw` → `public.lots`

**Inputs:**
- Staging data: `staging.copart_raw.lot_external_id`, site_code, city, auction_datetime, etc.
- Foreign key: `vehicles.vin` (must exist)
- Conflict resolution: Last-write-wins via `source_updated_at`

**Outputs:**
- `db/migrations/0013_lots_upsert_proc.sql` — Stored procedure for batch upsert
- `scripts/upsert-lots.js` — Node.js wrapper
- `docs/UPSERT_LOTS_LOGIC.md` — Decision tree and edge cases

**Tasks:**
1. Create stored procedure: `upsert_lots_batch(staging_file_id UUID)`
2. Logic:
   ```sql
   INSERT INTO lots (lot_external_id, vin, source, site_code, city, region, country, tz, auction_datetime_utc, retail_value_usd, status, source_updated_at)
   SELECT
     lot_external_id,
     normalize_vin(vin_raw),
     'copart',
     payload_jsonb->>'Yard number',
     payload_jsonb->>'Location city',
     ...
   FROM staging.copart_raw
   WHERE file_id = staging_file_id
     AND lot_external_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM vehicles WHERE vin = normalize_vin(staging.copart_raw.vin_raw))
   ON CONFLICT (lot_external_id)
   DO UPDATE SET
     vin = EXCLUDED.vin,
     site_code = EXCLUDED.site_code,
     ...
     source_updated_at = EXCLUDED.source_updated_at,
     updated_at = now()
   WHERE lots.source_updated_at < EXCLUDED.source_updated_at;
   ```
3. Status mapping: "Pure Sale" → 'active', "Sold" → 'sold', etc.
4. Timestamp parsing: "Last Updated Time" → TIMESTAMPTZ
5. Audit logging: Record conflicts in `audit.lot_conflicts`

**Acceptance Criteria:**
- [ ] Batch upsert processes 150K rows in <30 seconds
- [ ] No orphan lots (all reference valid `vehicles.vin`)
- [ ] Existing lots updated (not duplicated)
- [ ] Audit log captures all conflicts
- [ ] Status mapped correctly (CSV → canonical)

**Risks:**
- Orphans: VIN not in `vehicles` → lot insert fails
- Status unknowns: New CSV value → unmapped

**Rollback:**
- Delete from `lots` WHERE `updated_at` > rollback_timestamp
- Restore from `audit.lot_conflicts`

**DoD:**
- [ ] run1.csv → 153,991 lots inserted
- [ ] run2.csv → overlapping lots updated, no duplicates
- [ ] No orphan lots (JOIN to vehicles succeeds for all)

---

### MS-S1B-05: Completion Detector

**Objective:** Detect when a lot disappears from CSV after auction → set PENDING_RESULT

**Inputs:**
- Current CSV VIN/lot list
- Previous CSV VIN/lot list (from 15 minutes ago)
- Auction datetime: `lots.auction_datetime_utc`

**Outputs:**
- `scripts/detect-completion.js` — Completion detection logic
- `docs/COMPLETION_DETECTOR_LOGIC.md` — State machine and rules
- `db/migrations/0014_completion_views.sql` — Views for disappeared lots

**Tasks:**
1. After each CSV ingest, compare VIN/lot lists:
   ```sql
   SELECT vin, lot_external_id
   FROM lots
   WHERE status IN ('active', 'scheduled')
     AND auction_datetime_utc < (now() - INTERVAL '2 hours')
     AND lot_external_id NOT IN (
       SELECT lot_external_id FROM staging.copart_raw WHERE file_id = current_file_id
     );
   ```
2. Set status: `UPDATE lots SET status = 'PENDING_RESULT' WHERE ...`
3. Grace period: Wait 2 hours post-auction before marking PENDING_RESULT
4. Audit logging: Record transition in `audit.status_transitions`
5. Idempotency: Re-running detection → no duplicate transitions

**Acceptance Criteria:**
- [ ] Lots that disappear 2+ hours post-auction → marked PENDING_RESULT
- [ ] Lots still present → no status change
- [ ] Audit log records all transitions (timestamp, old status, new status)
- [ ] Idempotent: Re-running on same CSV → no duplicate updates

**Risks:**
- False positives: Lot removed temporarily → incorrectly marked PENDING_RESULT
- Grace period too short: Legit updates missed

**Rollback:**
- Revert status: `UPDATE lots SET status = 'active' WHERE status = 'PENDING_RESULT' AND updated_at > rollback_timestamp`

**DoD:**
- [ ] Test with synthetic CSV (remove 10 lots) → 10 marked PENDING_RESULT
- [ ] Audit log shows 10 transitions
- [ ] No false positives for lots still in CSV

---

### MS-S1B-06: End-to-End Integration & Testing

**Objective:** Integrate all components and validate with run1.csv + run2.csv

**Inputs:**
- All previous mini-sprint deliverables
- Test datasets: run1.csv (153,991 rows), run2.csv (overlapping + updates)

**Outputs:**
- `tests/integration/etl-e2e.test.js` — End-to-end test suite
- `docs/ETL_E2E_VALIDATION.md` — Test results and metrics
- `docs/ROLLBACK_PROCEDURES.md` — Emergency rollback steps

**Tasks:**
1. Run full pipeline:
   - Fetch CSV (mock for test)
   - Ingest → RAW
   - Extract → Staging
   - Upsert → Vehicles
   - Upsert → Lots
   - Detect completion
2. Validate:
   - No duplicate VINs in `vehicles`
   - No duplicate lot_external_id in `lots`
   - Audit logs populated
   - Metrics match expectations (ingest_count, conflicts, completion)
3. Test overlapping CSVs (run1 + run2):
   - Shared VINs updated (not duplicated)
   - New VINs inserted
   - Disappeared lots marked PENDING_RESULT
4. Performance benchmarks:
   - Fetch: <10 seconds
   - Ingest (RAW→Staging): <40 seconds
   - Upsert (Vehicles): <30 seconds
   - Upsert (Lots): <30 seconds
   - Completion detection: <5 seconds
   - **Total:** <2 minutes per window

**Acceptance Criteria:**
- [ ] Full pipeline (fetch → completion) runs successfully
- [ ] run1.csv: 153,991 vehicles + 153,991 lots
- [ ] run2.csv: Updates existing + inserts new (no duplicates)
- [ ] Completion detector marks disappeared lots
- [ ] All metrics within targets
- [ ] Zero data loss (RAW JSONB preserved)

**Risks:**
- Performance degradation at scale (>200K rows)
- Memory leaks in Node.js process

**Rollback:**
- Disable systemd timer
- Restore database from pre-sprint backup
- Revert migrations 0011-0014

**DoD:**
- [ ] 3 consecutive full pipeline runs (45 minutes) succeed
- [ ] No errors in logs
- [ ] Metrics dashboard shows green (all thresholds met)

---

## Dependencies & Sequencing

```
MS-S1B-01 (Automated Fetch)  ──┐
                                ├──> MS-S1B-06 (E2E Integration)
MS-S1B-02 (CSV Domain)       ──┤
MS-S1B-03 (Upsert Vehicles)  ──┤
MS-S1B-04 (Upsert Lots)      ──┤
MS-S1B-05 (Completion)       ──┘

Parallel execution possible:
- MS-S1B-01 (independent)
- MS-S1B-02 (independent)
- MS-S1B-03 + MS-S1B-04 (can run in parallel after MS-S1B-02)
- MS-S1B-05 (depends on MS-S1B-04)
```

**Critical Path:**
1. MS-S1B-02 (CSV Domain) — Required for upserts
2. MS-S1B-03 (Upsert Vehicles) — Required before lots (FK constraint)
3. MS-S1B-04 (Upsert Lots) — Required before completion
4. MS-S1B-05 (Completion) — Final logic
5. MS-S1B-06 (E2E) — Validation gate

**Estimated Duration:**
- MS-S1B-01: 4 hours
- MS-S1B-02: 3 hours
- MS-S1B-03: 3 hours
- MS-S1B-04: 3 hours
- MS-S1B-05: 2 hours
- MS-S1B-06: 3 hours
- **Total (sequential):** 18 hours
- **Total (with parallelization):** ~12 hours

---

## Acceptance Criteria — Sprint DoD

### Functional

- [ ] **F1:** CSV fetched automatically every 15 minutes (4 consecutive successful runs)
- [ ] **F2:** Full pipeline (fetch → completion) completes in <2 minutes
- [ ] **F3:** No duplicate VINs in `vehicles` table
- [ ] **F4:** No duplicate lot_external_id in `lots` table
- [ ] **F5:** Overlapping CSVs (run1 + run2) → updates (not duplicates)
- [ ] **F6:** Disappeared lots marked PENDING_RESULT 2+ hours post-auction
- [ ] **F7:** RU/EN taxonomies display correctly in API v1 responses

### Non-Functional

- [ ] **NF1:** Throughput ≥2,500 rows/second (vehicles + lots combined)
- [ ] **NF2:** Idempotent: Re-running same CSV → no data corruption
- [ ] **NF3:** Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- [ ] **NF4:** Circuit breaker: 5 consecutive failures → disable auto-fetch + alert
- [ ] **NF5:** Structured logs (JSON) with context (timestamp, duration, status)
- [ ] **NF6:** Audit logs populated for all conflicts (vehicles + lots)

### Observability

- [ ] **O1:** Metrics dashboard shows: ingest_count, unknown_rate, parse_errors, fetch_failures
- [ ] **O2:** Alerts configured: unknown_rate >25%, parse_errors >0, fetch_failures >3
- [ ] **O3:** Grafana panels (or equivalent): throughput, latency, error rate

### Security

- [ ] **S1:** Copart credentials in vault (not .env.runtime)
- [ ] **S2:** Session cookie encrypted at rest
- [ ] **S3:** No credentials in logs (mask password/cookie)
- [ ] **S4:** Rate limiting: Max 1 fetch per 15 minutes

### Documentation

- [ ] **D1:** All planning docs complete (ETL_PLAN.md, CSV_DOMAIN.md, TAXONOMIES_RU_EN.md, DEPLOY_RUNBOOK_ETL.md)
- [ ] **D2:** Runbooks for: manual fetch, session refresh, rollback
- [ ] **D3:** API v1 contract updated with RU/EN taxonomy endpoints

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **R1:** Copart blocks automated fetching (Imperva/bot detection) | Medium | High | Use residential proxy; rotate UA; add random jitter (±2 min) |
| **R2:** Session cookie expires mid-fetch | Medium | Medium | Preemptive refresh every 23h; fallback to re-login |
| **R3:** CSV schema changes (new columns/values) | Low | High | Lossless JSONB storage; unknown taxonomy handler; alerts on new columns |
| **R4:** Performance degradation (>200K rows) | Medium | Medium | Batch size tuning; partitioning raw.rows by month; archive old data to R2 |
| **R5:** VIN conflicts (same VIN, different vehicles) | Low | High | Audit log captures conflicts; manual review queue; VIN history table |
| **R6:** Network failures during fetch | High | Low | Retry with exponential backoff; circuit breaker; alert on 3rd failure |
| **R7:** Database deadlocks (concurrent upserts) | Low | Medium | Batch locking; row-level locks; retry on deadlock error |

---

## Monitoring & Alerts

### Metrics to Track

**Fetch Metrics:**
- `copart_fetch_duration_seconds` (histogram)
- `copart_fetch_failures_total` (counter)
- `copart_fetch_success_total` (counter)
- `copart_session_refresh_total` (counter)

**Ingestion Metrics:**
- `etl_ingest_rows_total` (counter)
- `etl_ingest_duration_seconds` (histogram)
- `etl_parse_errors_total` (counter)
- `etl_unknown_rate_percent` (gauge)

**Upsert Metrics:**
- `etl_vehicle_upserts_total` (counter)
- `etl_vehicle_conflicts_total` (counter)
- `etl_lot_upserts_total` (counter)
- `etl_lot_conflicts_total` (counter)
- `etl_orphan_lots_total` (counter)

**Completion Metrics:**
- `etl_pending_result_total` (counter)
- `etl_status_transitions_total` (counter by old_status, new_status)

### Alert Rules

**Critical:**
- `copart_fetch_failures_total` ≥3 consecutive → PagerDuty
- `etl_parse_errors_total` >0 → PagerDuty
- `etl_orphan_lots_total` >0 → PagerDuty

**Warning:**
- `etl_unknown_rate_percent` >25% → Slack
- `etl_ingest_duration_seconds` >120s → Slack
- `copart_fetch_duration_seconds` >15s → Slack

**Info:**
- `etl_vehicle_conflicts_total` >100 per run → Log (expected for overlapping CSVs)
- `copart_session_refresh_total` → Log (daily expected)

---

## Rollback Procedures

### Emergency Rollback (Full Sprint)

**Scenario:** Critical bug in upsert logic → data corruption

**Steps:**
1. **Disable automation:**
   ```bash
   systemctl stop copart-etl.timer
   systemctl disable copart-etl.timer
   ```

2. **Revert database:**
   ```bash
   psql $DATABASE_URL -c "BEGIN;"
   psql $DATABASE_URL -f db/rollback/0014_rollback.sql
   psql $DATABASE_URL -f db/rollback/0013_rollback.sql
   psql $DATABASE_URL -f db/rollback/0012_rollback.sql
   psql $DATABASE_URL -f db/rollback/0011_rollback.sql
   psql $DATABASE_URL -c "COMMIT;"
   ```

3. **Restore from backup (if needed):**
   ```bash
   pg_restore -d vinops_db backup_pre_s1b.dump
   ```

4. **Verify:**
   ```sql
   SELECT COUNT(*) FROM vehicles;  -- Should match pre-sprint count
   SELECT COUNT(*) FROM lots;      -- Should match pre-sprint count
   ```

5. **Revert to manual workflow:**
   - Download CSVs manually
   - Run `node scripts/ingest-copart-csv.js <path>`

**Recovery Time Objective (RTO):** <30 minutes
**Recovery Point Objective (RPO):** Last successful backup (≤15 minutes data loss)

### Partial Rollback (Single Component)

**Scenario:** Completion detector has false positives

**Steps:**
1. **Disable completion detection:**
   ```sql
   UPDATE config SET completion_detector_enabled = FALSE;
   ```

2. **Revert status changes:**
   ```sql
   UPDATE lots
   SET status = 'active', updated_at = now()
   WHERE status = 'PENDING_RESULT'
     AND updated_at > '2025-10-16 12:00:00 UTC';
   ```

3. **Investigate:**
   - Review audit.status_transitions
   - Identify false positives
   - Fix detection logic
   - Re-deploy

---

## Next Steps (Post-S1B)

**S2: SSR/SEO VIN & Catalog**
- API v1 contract finalized (with RU/EN taxonomy endpoints)
- SSR pages consume taxonomies for user display
- VIN shards generation (≤50k per file, lastmod from lots.updated_at)

**S3: Images Module**
- R2 storage for original images
- Derivative generation (thumb, md, xl)
- Watermark application
- CDN integration

**S4: Sales Finalizer**
- Transition PENDING_RESULT → SOLD/NO_SALE
- Scrape final bid data
- Update sale_events table

---

## Sign-Off

**Planning Team:**
- [ ] Tech Lead — Sprint scope approved
- [ ] Database Admin — Schema changes reviewed
- [ ] DevOps — Infrastructure capacity confirmed
- [ ] Security — Credentials/vault strategy approved

**Implementation Ready:** ✅ APPROVED FOR EXECUTION

**Next Phase:** Exit plan mode → Begin MS-S1B-01 (Automated CSV Fetching)

---

**Date:** 2025-10-16
**Version:** v1.0
**Status:** 📋 PLANNING COMPLETE — Ready for implementation
