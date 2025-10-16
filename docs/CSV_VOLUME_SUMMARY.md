# CSV Volume Summary — Copart Sales Data Coverage

**Source:** run1.csv (153,991 rows)
**Analysis Date:** 2025-10-16
**Sprint:** S1 — ETL A (CSV→PG)

---

## Executive Summary

**Total Rows:** 153,991 (run1), 153,983 (run2) → **-8 row delta**
**Total Columns:** 59
**Mandatory Fields (100% coverage):** 31/59 (52.5%)
**Mostly Populated (95-99%):** 10/59 (16.9%)
**Partial Coverage (50-95%):** 5/59 (8.5%)
**Sparse/Empty (<50%):** 13/59 (22.0%)

**Unknown Rate:** 22.0% (13 columns < 50% coverage)
**Assessment:** ✅ ACCEPTABLE (target ≤25%; primarily offsite/rental fields)

---

## Coverage Tiers

### Tier 1: Mandatory (100% Coverage) — 31 Columns

**Key Identifiers:**
- Id ✅
- Lot number ✅ (PRIMARY KEY)
- Year ✅
- Make ✅
- Model Group ✅

**Location:**
- Yard number ✅
- Yard name ✅
- Location city ✅
- Location state ✅
- Location ZIP ✅
- Location country ✅
- Time Zone ✅

**Sale Information:**
- Sale Date M/D/CY ✅
- Item# ✅
- Vehicle Type ✅
- Sale Status ✅
- High Bid ✅ (current bid)

**Vehicle Attributes:**
- Model Detail ✅
- Color ✅
- Damage Description ✅
- Odometer ✅
- Est. Retail Value ✅
- Repair cost ✅

**Financial:**
- Currency Code ✅
- Buy-It-Now Price ✅

**Metadata:**
- Create Date/Time ✅
- Last Updated Time ✅ (UPSERT KEY)
- Make-an-Offer Eligible ✅
- Image URL ✅

**Rentals/Copart Select:** (100% but mostly "N"/empty value)
- Rentals ✅
- Copart Select ✅

---

### Tier 2: Mostly Populated (95-99%) — 10 Columns

| Column | Coverage | Non-Empty | Empty | Notes |
|--------|----------|-----------|-------|-------|
| Has Keys | 100.00% | 153,991 | 0 | "YES"/"NO" |
| Sale Title State | 100.00% | 153,991 | 0 | State codes |
| **VIN** | **99.99%** | 153,983 | 8 | **8 missing VINs** |
| Sale Title Type | 99.99% | 153,989 | 2 | "NR", "SC", etc. |
| Odometer Brand | 99.99% | 153,987 | 4 | "A", "E", "N", "T" |
| Image Thumbnail | 99.98% | 153,961 | 30 | CDN URLs |
| Grid/Row | 99.90% | 153,836 | 155 | Physical location |
| Fuel Type | 96.56% | 148,680 | 5,311 | "GAS", "DIESEL", etc. |
| Engine | 95.25% | 146,675 | 7,316 | Engine description |
| Cylinders | 95.25% | 146,675 | 7,316 | Correlated with Engine |

**Key Insight:** VIN missing in only 8 rows (0.01%) — acceptable for lot retention without vehicle upsert

---

### Tier 3: Partial Coverage (50-95%) — 5 Columns

| Column | Coverage | Non-Empty | Empty | Notes |
|--------|----------|-----------|-------|-------|
| Transmission | 94.83% | 146,008 | 7,983 | "AUTOMATIC", "MANUAL" |
| Lot Cond. Code | 94.76% | 145,907 | 8,084 | "D", "R", etc. |
| Runs/Drives | 94.76% | 145,907 | 8,084 | Drivability status |
| Drive | 94.29% | 145,186 | 8,805 | "FWD", "RWD", "AWD" |
| Trim | 86.37% | 133,000 | 20,991 | Vehicle trim level |

**Impact:** High-value fields with partial coverage; retain in core schema

---

### Tier 4: Sparse/Empty (<50%) — 13 Columns

| Column | Coverage | Non-Empty | Empty | Notes |
|--------|----------|-----------|-------|-------|
| Day of Week | 46.70% | 71,903 | 82,088 | Often empty |
| Sale time (HHMM) | 46.70% | 71,903 | 82,088 | Correlated with Day of Week |
| Secondary Damage | 43.03% | 66,280 | 87,711 | Additional damage |
| Seller Name | 34.41% | 52,999 | 100,992 | Seller information |
| Body Style | 18.22% | 28,060 | 125,931 | Body type |
| Special Note | 3.49% | 5,375 | 148,616 | Rare notes |
| **Offsite Address1** | 1.38% | 2,125 | 151,866 | Offsite storage |
| **Offsite State** | 1.38% | 2,125 | 151,866 | Offsite storage |
| **Offsite City** | 1.38% | 2,125 | 151,866 | Offsite storage |
| **Offsite Zip** | 1.38% | 2,125 | 151,866 | Offsite storage |
| Sale Light | 0.34% | 523 | 153,468 | Auction indicator |
| AutoGrade | 0.34% | 523 | 153,468 | Grading system |
| Announcements | 0.22% | 339 | 153,652 | Special announcements |

**Recommendation:** Store in JSONB payload only; do not create dedicated columns

---

## Unknown Rate Analysis

**Calculation:** 13 columns < 50% coverage / 59 total = **22.0%**

**Breakdown:**
- Offsite fields: 4 columns (1.38% each) → ~1.4K rows with offsite data
- Low-usage flags: 3 columns (0.22-0.34%) → <1K rows
- Partial sale info: 2 columns (46.70%) → Day of Week, Sale time
- Other: 4 columns (3-43%) → Body Style, Special Note, Seller, Secondary Damage

**Assessment:**
- ✅ **PASS:** 22.0% is below 25% threshold
- Empty columns are non-critical (offsite storage, announcements, grades)
- Core fields (VIN, Make, Model, Damage, Odometer) all >95%

---

## Delta Analysis (run1 vs run2)

**Row Delta:** 153,991 (run1) → 153,983 (run2) = **-8 rows**

**Possible Causes:**
1. Lots sold/removed from inventory
2. Status changes (e.g., moved to "Future Sale")
3. Data corrections

**Action:** Track deltas in `audit.etl_runs` table for historical analysis

---

## VIN Coverage Detail

**Total VINs:** 153,983 / 153,991 rows = 99.99%
**Missing VINs:** 8 rows (0.01%)

**Impact on Upsert Strategy:**
- Lots with missing VIN: Retain in `lots` table, skip `vehicles` upsert
- VIN conflicts: Log to `audit.vin_conflicts`
- VIN normalization: Apply to all non-null VINs

**Example Missing VIN Rows:**
- Row IDs: (sample inspection needed to identify patterns)
- Common traits: Check if specific vehicle types, statuses, or yards

---

## Coverage by Entity

### vehicles Table (Vehicle Attributes)
**High Coverage (>95%):**
- VIN: 99.99%
- Year: 100%
- Make: 100%
- Model: 100%
- Color: 100%
- Fuel Type: 96.56%
- Engine: 95.25%

**Partial Coverage (85-95%):**
- Transmission: 94.83%
- Drive: 94.29%
- Trim: 86.37%

**Low Coverage (<85%):**
- Body Style: 18.22% ⚠️ (consider JSONB)

### lots Table (Lot/Sale Attributes)
**High Coverage (>95%):**
- Lot number: 100% ✅ (PRIMARY KEY)
- Sale Status: 100%
- Location: 100% (city/state/ZIP/country)
- Odometer: 100%
- Est. Retail Value: 100%
- Last Updated Time: 100% ✅ (UPSERT KEY)

**Partial Coverage:**
- Lot Cond. Code: 94.76%
- Runs/Drives: 94.76%
- Secondary Damage: 43.03%
- Day of Week: 46.70%
- Sale time: 46.70%

### sale_events Table (Bidding/Sale)
**High Coverage:**
- High Bid: 100% (current bid, may be 0)
- Buy-It-Now Price: 100% (often 0)
- Sale Date: 100% (needs parsing)

### images Table (Media)
**High Coverage:**
- Image URL: 100%
- Image Thumbnail: 99.98%

---

## Data Quality Notes

**Numeric Fields with "0" Defaults:**
- Item# = 0 in many rows (unclear purpose)
- Repair cost = 0.0 (estimate not always provided)
- Buy-It-Now Price = 0.0 (feature not always enabled)
- High Bid = 0.0 (no bids yet)
- Sale Date = 0 (not yet scheduled?)

**Action:** Treat 0 as NULL/unknown for analytics; retain raw value in JSONB

**Timestamp Consistency:**
- Last Updated Time: 100% coverage, ISO 8601 format ✅
- Create Date/Time: 100% coverage, non-standard format (needs parser)

---

## Recommendations

### Schema Design
1. **Core Columns:** Create dedicated columns for Tier 1 + Tier 2 fields (41 columns)
2. **Partial Columns:** Create for Tier 3 fields (5 columns) — high business value
3. **JSONB Storage:** Store Tier 4 (<50% coverage) in `payload_jsonb` only

### ETL Strategy
1. **Mandatory Fields:** Fail row processing if any Tier 1 field is malformed
2. **VIN Handling:** Allow NULL VIN (0.01%), skip vehicle upsert, retain lot
3. **Unknown Rate Monitoring:** Alert if >25% (currently 22%, safe margin)

### Quality Checks
1. **VIN Audit:** Investigate 8 missing VINs (row IDs, patterns)
2. **Delta Tracking:** Monitor -8 row difference between runs (normal churn?)
3. **Coverage Trending:** Track Tier 4 column usage over time (may increase)

---

## Change Log

**2025-10-16 (S1 Initial Analysis):**
- Analyzed run1.csv (153,991 rows)
- Calculated coverage for all 59 columns
- Determined unknown_rate: 22.0% (PASS)
- Documented tier structure and recommendations

---

**Next Steps:**
1. Commit MS-S1-02 completion
2. Begin MS-S1-03: RAW/staging schema DDLs
3. Investigate 8 missing VIN rows
4. Build taxonomy tables in MS-S1-04
