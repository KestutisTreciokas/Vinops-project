# CSV Schema Discovery — Copart Sales Data

**Source:** Copart inventory export via authenticated Member download
**Samples Analyzed:** run1.csv (153,991 rows), run2.csv (153,983 rows)
**Discovery Date:** 2025-10-16
**Sprint:** S1 — ETL A (CSV→PG)

---

## Executive Summary

**Total Columns:** 59 (confirmed across both samples)
**Key Identifier:** "Lot number" (100% populated, appears unique)
**Secondary Key:** "VIN" (99.99% populated)
**Timestamp Field:** "Last Updated Time" (ISO 8601 format, 100% populated)
**Row Delta:** 8 rows difference between samples (likely updates/removals)

---

## Column Inventory (All 59 Columns)

| # | Column Name | Type Hint | Mandatory | Notes |
|---|-------------|-----------|-----------|-------|
| 1 | Id | INTEGER | YES | Sequential row number in export (not stable) |
| 2 | Yard number | INTEGER | YES | Copart facility ID |
| 3 | Yard name | TEXT | YES | Facility name (e.g., "CA - VALLEJO") |
| 4 | Sale Date M/D/CY | INTEGER | MIXED | 0 or timestamp; unclear format |
| 5 | Day of Week | TEXT | NO | Often empty |
| 6 | Sale time (HHMM) | TEXT | NO | Often empty |
| 7 | Time Zone | TEXT | YES | e.g., "PDT", "EST" |
| 8 | Item# | INTEGER | YES | Often 0 |
| 9 | **Lot number** | INTEGER | **YES** | **PRIMARY KEY CANDIDATE** |
| 10 | Vehicle Type | TEXT | YES | e.g., "V" (vehicle) |
| 11 | Year | INTEGER | YES | 4-digit year |
| 12 | Make | TEXT | YES | e.g., "TOYOTA", "FORD" |
| 13 | Model Group | TEXT | YES | e.g., "COROLLA", "TRANSIT" |
| 14 | Model Detail | TEXT | MIXED | Specific trim/variant |
| 15 | Body Style | TEXT | NO | Often empty |
| 16 | Color | TEXT | YES | e.g., "GRAY", "WHITE" |
| 17 | Damage Description | TEXT | YES | Primary damage type |
| 18 | Secondary Damage | TEXT | MIXED | Additional damage |
| 19 | Sale Title State | TEXT | YES | State code (e.g., "CA") |
| 20 | Sale Title Type | TEXT | YES | e.g., "NR" (non-repairable), "SC" (salvage) |
| 21 | Has Keys-Yes or No | TEXT | YES | "YES" or "NO" |
| 22 | Lot Cond. Code | TEXT | YES | e.g., "D" (drivable?) |
| 23 | **VIN** | TEXT(17) | **YES** | **99.99% populated** |
| 24 | Odometer | NUMERIC | YES | Mileage reading |
| 25 | Odometer Brand | TEXT | YES | e.g., "A" (actual) |
| 26 | Est. Retail Value | NUMERIC | YES | USD value |
| 27 | Repair cost | NUMERIC | YES | Often 0.0 |
| 28 | Engine | TEXT | YES | e.g., "1.8L  4" |
| 29 | Drive | TEXT | YES | e.g., "Front-wheel Drive" |
| 30 | Transmission | TEXT | YES | e.g., "AUTOMATIC" |
| 31 | Fuel Type | TEXT | YES | e.g., "GAS" |
| 32 | Cylinders | INTEGER | YES | Number of cylinders |
| 33 | Runs/Drives | TEXT | YES | e.g., "Run & Drive Verified" |
| 34 | Sale Status | TEXT | YES | e.g., "Pure Sale", "On Minimum Bid" |
| 35 | High Bid =non-vix,Sealed=Vix | NUMERIC | YES | Current bid amount |
| 36 | Special Note | TEXT | NO | Often empty |
| 37 | Location city | TEXT | YES | Auction city |
| 38 | Location state | TEXT | YES | State code |
| 39 | Location ZIP | TEXT | YES | ZIP code with suffix |
| 40 | Location country | TEXT | YES | e.g., "USA" |
| 41 | Currency Code | TEXT | YES | e.g., "USD" |
| 42 | Image Thumbnail | TEXT | YES | Copart CDN URL |
| 43 | Create Date/Time | TEXT | YES | Timestamp (unusual format) |
| 44 | Grid/Row | TEXT | MIXED | Physical lot location |
| 45 | Make-an-Offer Eligible | TEXT | YES | "N" or "Y" |
| 46 | Buy-It-Now Price | NUMERIC | YES | Often 0.0 |
| 47 | Image URL | TEXT | YES | API endpoint for images |
| 48 | Trim | TEXT | MIXED | Vehicle trim level |
| 49 | **Last Updated Time** | TIMESTAMPTZ | **YES** | **ISO 8601 format** |
| 50 | Rentals | TEXT | NO | Often empty |
| 51 | Copart Select | TEXT | NO | Often empty |
| 52 | Seller Name | TEXT | NO | Often empty |
| 53 | Offsite Address1 | TEXT | NO | Often empty |
| 54 | Offsite State | TEXT | NO | Often empty |
| 55 | Offsite City | TEXT | NO | Often empty |
| 56 | Offsite Zip | TEXT | NO | Often empty |
| 57 | Sale Light | TEXT | NO | Often empty |
| 58 | AutoGrade | TEXT | NO | Often empty |
| 59 | Announcements | TEXT | NO | Often empty |

---

## Data Types & Examples

### Key Identifiers

**Lot number** (col #9)
- **Type:** INTEGER (large)
- **Examples:** 45148624, 47250074, 47704465
- **Uniqueness:** 100% populated, appears unique across samples
- **Usage:** PRIMARY KEY for upsert operations

**Id** (col #1)
- **Type:** INTEGER (sequential)
- **Examples:** 1, 2, 3, ...
- **WARNING:** Sequential row number in export, NOT stable across downloads
- **Usage:** DO NOT USE as primary key

**VIN** (col #23)
- **Type:** TEXT(17) (standard VIN format)
- **Examples:** JTDVPRAEXLJ074010, 1FMZK1ZM7GKA75186
- **Coverage:** 99.99% (8 missing VINs in run1, 8 in run2)
- **Validation:** Must match `^[A-HJ-NPR-Z0-9]{11,17}$`

### Timestamps

**Last Updated Time** (col #49)
- **Type:** TIMESTAMPTZ (ISO 8601)
- **Format:** `2025-10-14T07:01:00Z` (UTC)
- **Coverage:** 100%
- **Usage:** Source timestamp for conflict resolution (last-write-wins)

**Create Date/Time** (col #43)
- **Type:** TEXT (non-standard format)
- **Format:** `2025-10-14-08.55.06.000795` (needs parsing)
- **Usage:** Secondary timestamp (creation vs update)

### Vehicle Attributes

**Year** (col #11)
- **Type:** INTEGER
- **Range:** 1900-2025 (estimated)
- **Examples:** 2020, 2016, 2017

**Make** (col #12)
- **Type:** TEXT (uppercase)
- **Examples:** TOYOTA, FORD, HYUNDAI
- **Domain:** Open vocabulary (~50+ distinct values expected)

**Model Group** (col #13)
- **Type:** TEXT (uppercase)
- **Examples:** COROLLA, TRANSIT, ELANTRA
- **Usage:** Canonical model name

**Model Detail** (col #14)
- **Type:** TEXT
- **Examples:** "COROLLA LE", "TRANSIT T-"
- **Usage:** Specific variant/trim

### Damage & Condition

**Damage Description** (col #17)
- **Type:** TEXT
- **Examples:** "WATER/FLOOD", "REAR END"
- **Domain:** Limited vocabulary (taxonomy TBD)

**Secondary Damage** (col #18)
- **Type:** TEXT
- **Examples:** "ALL OVER", "" (often empty)

**Runs/Drives** (col #33)
- **Type:** TEXT
- **Examples:** "Run & Drive Verified", "Starts"
- **Domain:** Limited vocabulary

### Sale Information

**Sale Status** (col #34)
- **Type:** TEXT
- **Examples:** "Pure Sale", "On Minimum Bid"
- **Domain:** Limited vocabulary (taxonomy TBD)

**High Bid** (col #35)
- **Type:** NUMERIC(10,2)
- **Examples:** 1050.0, 0.0
- **Usage:** Current bid amount (0 if no bids)

**Sale Title Type** (col #20)
- **Type:** TEXT (codes)
- **Examples:** "NR" (non-repairable), "SC" (salvage certificate)
- **Domain:** Limited vocabulary (taxonomy TBD)

### Location

**Yard number** (col #2)
- **Type:** INTEGER
- **Examples:** 1 (Vallejo, CA)

**Yard name** (col #3)
- **Type:** TEXT
- **Examples:** "CA - VALLEJO"

**Location city/state/ZIP/country** (cols #37-40)
- **Type:** TEXT
- **Examples:** "VALLEJO", "CA", "94590 7203", "USA"

### Images

**Image Thumbnail** (col #42)
- **Type:** TEXT (URL)
- **Format:** `cs.copart.com/v1/AUTH_svc.pdoc00001/lpp/...`
- **Usage:** CDN URL for thumbnail image

**Image URL** (col #47)
- **Type:** TEXT (API endpoint)
- **Format:** `http://inventoryv2.copart.io/v1/lotImages/{lot_number}?country=us&brand=cprt&yardNumber={yard}`
- **Usage:** API to fetch all images for a lot

---

## Missing/Empty Columns (HIGH unknown_rate)

**Consistently Empty (>90% NULL):**
- Day of Week (col #5)
- Sale time (HHMM) (col #6)
- Item# (col #8) — often 0
- Body Style (col #15)
- Special Note (col #36)
- Grid/Row (col #44) — mixed
- Rentals (col #50)
- Copart Select (col #51)
- Seller Name (col #52)
- Offsite Address1-Zip (cols #53-56)
- Sale Light (col #57)
- AutoGrade (col #58)
- Announcements (col #59)

**Impact:** ~10-12 columns effectively unused → **unknown_rate ≈ 17-20%**

---

## Data Quality Issues

### Missing VINs
- **run1.csv:** 8 rows missing VIN (0.01%)
- **run2.csv:** 8 rows missing VIN (0.01%)
- **Action:** Flag lots with missing VIN; skip vehicle upsert but retain lot record

### Timestamp Parsing
- **Create Date/Time:** Non-standard format requires custom parser
- **Last Updated Time:** ISO 8601, parse with `TIMESTAMPTZ` directly

### Domain Validation
- **Sale Title Type:** Codes need lookup table (NR, SC, etc.)
- **Damage Description:** Open vocabulary, requires taxonomy
- **Sale Status:** Limited vocabulary, requires taxonomy

---

## Schema Stability

**Header Consistency:** ✅ Both samples have identical 59-column header
**Column Order:** ✅ Stable across samples
**Data Types:** ✅ Consistent (no type conflicts detected)
**Future Risk:** ⚠️ Copart may add/remove columns; store headers_jsonb in `raw.csv_files`

---

## Recommendations

1. **Primary Key:** Use `lot_external_id` (mapped from "Lot number")
2. **Upsert Timestamp:** Use `source_updated_at` (mapped from "Last Updated Time")
3. **VIN Handling:** Store raw in `vin_raw`, normalized in `vin`
4. **Unknown Columns:** Accept 17-20% unknown_rate (mostly empty fields)
5. **Taxonomy:** Build lookup tables for damage, title, status codes
6. **Schema Versioning:** Store `headers_jsonb` per file for schema evolution tracking

---

## Next Steps

1. Create `CSV_HEADER_MAP.md` with canonical name mappings
2. Create `CSV_VOLUME_SUMMARY.md` with detailed coverage stats
3. Build taxonomy tables for damage/title/status domains
4. Implement CSV parser with robust null handling

---

**Analysis Complete:** MS-S1-02 schema discovery
**Artifacts:** CSV_SCHEMA_DISCOVERED.md
**Status:** ✅ READY for mapping (MS-S1-04)
