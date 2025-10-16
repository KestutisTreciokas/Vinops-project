# CSV Header Map — Copart to Canonical Names

**Purpose:** Map Copart CSV column names to canonical database field names
**Source:** CSV_SCHEMA_DISCOVERED.md (59 columns)
**Sprint:** S1 — ETL A (CSV→PG)
**Version:** v1 (initial mapping)

---

## Mapping Table

| CSV Column Name | Canonical Name | Target Table.Column | Type | Notes |
|-----------------|----------------|---------------------|------|-------|
| **Id** | `row_sequence` | raw.rows.row_no | INTEGER | Export sequence (not stable) |
| **Lot number** | `lot_external_id` | lots.lot_external_id | TEXT | **PRIMARY KEY** for upsert |
| **VIN** | `vin_raw` | vehicles.vin_raw | TEXT(17) | Original VIN (normalized separately) |
| **Year** | `year` | vehicles.year | INTEGER | Vehicle year |
| **Make** | `make` | vehicles.make | TEXT | Uppercase make |
| **Model Group** | `model` | vehicles.model | TEXT | Canonical model name |
| **Model Detail** | `model_detail` | vehicles.model_detail | TEXT | Trim/variant |
| **Last Updated Time** | `source_updated_at` | lots.source_updated_at | TIMESTAMPTZ | ISO 8601 timestamp |
| **Yard number** | `yard_number` | lots.site_code | TEXT | Copart facility ID |
| **Yard name** | `yard_name` | lots.yard_name | TEXT | Facility name |
| **Sale Date M/D/CY** | `sale_date_raw` | lots.sale_date_raw | INTEGER | Needs parsing |
| **Day of Week** | `sale_day_of_week` | lots.sale_day_of_week | TEXT | Often empty |
| **Sale time (HHMM)** | `sale_time_hhmm` | lots.sale_time_hhmm | TEXT | Often empty |
| **Time Zone** | `timezone` | lots.tz | TEXT | e.g., "PDT", "EST" |
| **Item#** | `item_number` | lots.item_number | INTEGER | Often 0 |
| **Vehicle Type** | `vehicle_type` | lots.vehicle_type | TEXT | e.g., "V" (vehicle) |
| **Body Style** | `body_style` | vehicles.body | TEXT | Often empty |
| **Color** | `color` | vehicles.color | TEXT | External color |
| **Damage Description** | `damage_primary` | lots.damage_description | TEXT | Primary damage type |
| **Secondary Damage** | `damage_secondary` | lots.secondary_damage | TEXT | Additional damage |
| **Sale Title State** | `title_state` | lots.title_state | TEXT | State code |
| **Sale Title Type** | `title_type` | lots.title_type | TEXT | e.g., "NR", "SC" |
| **Has Keys-Yes or No** | `has_keys` | lots.has_keys | BOOLEAN | Convert "YES"→TRUE |
| **Lot Cond. Code** | `lot_condition_code` | lots.lot_condition_code | TEXT | e.g., "D" |
| **Odometer** | `odometer` | lots.odometer | NUMERIC(10,1) | Mileage |
| **Odometer Brand** | `odometer_brand` | lots.odometer_brand | TEXT | e.g., "A" (actual) |
| **Est. Retail Value** | `retail_value_usd` | lots.retail_value_usd | NUMERIC(12,2) | Estimated value |
| **Repair cost** | `repair_cost_usd` | lots.repair_cost_usd | NUMERIC(12,2) | Often 0 |
| **Engine** | `engine` | vehicles.engine | TEXT | Engine description |
| **Drive** | `drive` | vehicles.drive | TEXT | Drivetrain type |
| **Transmission** | `transmission` | vehicles.transmission | TEXT | Transmission type |
| **Fuel Type** | `fuel` | vehicles.fuel | TEXT | Fuel type |
| **Cylinders** | `cylinders` | vehicles.cylinders | INTEGER | Number of cylinders |
| **Runs/Drives** | `runs_drives` | lots.runs_drives | TEXT | Drivability status |
| **Sale Status** | `status` | lots.status | TEXT | Sale status code |
| **High Bid =non-vix,Sealed=Vix** | `current_bid_usd` | sale_events.final_bid_usd | NUMERIC(12,2) | Current bid |
| **Special Note** | `special_note` | lots.special_note | TEXT | Often empty |
| **Location city** | `location_city` | lots.city | TEXT | Auction city |
| **Location state** | `location_state` | lots.region | TEXT | State/region |
| **Location ZIP** | `location_zip` | lots.location_zip | TEXT | ZIP code |
| **Location country** | `location_country` | lots.country | TEXT | Country code |
| **Currency Code** | `currency_code` | lots.currency_code | CHAR(3) | ISO 4217 |
| **Image Thumbnail** | `image_thumbnail_url` | images.thumbnail_url | TEXT | CDN URL |
| **Create Date/Time** | `created_at_raw` | lots.created_at_raw | TEXT | Non-standard format |
| **Grid/Row** | `grid_row` | lots.grid_row | TEXT | Physical location |
| **Make-an-Offer Eligible** | `make_offer_eligible` | lots.make_offer_eligible | BOOLEAN | "N"→FALSE |
| **Buy-It-Now Price** | `buy_it_now_usd` | lots.buy_it_now_usd | NUMERIC(12,2) | Often 0 |
| **Image URL** | `image_api_url` | images.source_url | TEXT | API endpoint |
| **Trim** | `trim` | vehicles.trim | TEXT | Trim level |
| **Rentals** | `rentals` | lots.rentals | TEXT | Often empty |
| **Copart Select** | `copart_select` | lots.copart_select | TEXT | Often empty |
| **Seller Name** | `seller_name` | lots.seller_name | TEXT | Often empty |
| **Offsite Address1** | `offsite_address` | lots.offsite_address | TEXT | Often empty |
| **Offsite State** | `offsite_state` | lots.offsite_state | TEXT | Often empty |
| **Offsite City** | `offsite_city` | lots.offsite_city | TEXT | Often empty |
| **Offsite Zip** | `offsite_zip` | lots.offsite_zip | TEXT | Often empty |
| **Sale Light** | `sale_light` | lots.sale_light | TEXT | Often empty |
| **AutoGrade** | `autograde` | lots.autograde | TEXT | Often empty |
| **Announcements** | `announcements` | lots.announcements | TEXT | Often empty |

---

## Mapping Rules

### Key Fields (MANDATORY)

**lot_external_id** (Upsert Key)
- **Source:** "Lot number"
- **Type:** TEXT (store as string for stability)
- **Validation:** NOT NULL, UNIQUE
- **Usage:** Primary key for upsert operations

**vin_raw** (Vehicle Identifier)
- **Source:** "VIN"
- **Type:** TEXT(17)
- **Validation:** 11-17 characters, uppercase
- **Normalization:** Apply `normalize_vin()` → `vehicles.vin`
- **NULL Handling:** Allow NULL (0.01% missing); skip vehicle upsert but retain lot

**source_updated_at** (Conflict Resolution)
- **Source:** "Last Updated Time"
- **Type:** TIMESTAMPTZ
- **Format:** ISO 8601 (`2025-10-14T07:01:00Z`)
- **Usage:** Last-write-wins comparison in upsert

### Type Conversions

**Boolean Fields:**
- "Has Keys-Yes or No" → `has_keys BOOLEAN`
  - "YES" → TRUE
  - "NO" → FALSE
  - "" → NULL

- "Make-an-Offer Eligible" → `make_offer_eligible BOOLEAN`
  - "Y" → TRUE
  - "N" → FALSE

**Numeric Fields:**
- Odometer: `NUMERIC(10,1)` (mileage with decimal)
- Retail Value: `NUMERIC(12,2)` (USD with cents)
- Repair Cost: `NUMERIC(12,2)`
- Current Bid: `NUMERIC(12,2)`
- Buy-It-Now: `NUMERIC(12,2)`

**Timestamp Fields:**
- "Last Updated Time": Parse as `TIMESTAMPTZ` (ISO 8601)
- "Create Date/Time": Custom parser for `2025-10-14-08.55.06.000795` format
- "Sale Date M/D/CY": INTEGER (needs investigation; often 0)

### VIN Normalization

**normalize_vin() Function:**
```sql
CREATE OR REPLACE FUNCTION normalize_vin(raw TEXT) RETURNS TEXT AS $$
BEGIN
  IF raw IS NULL OR raw = '' THEN
    RETURN NULL;
  END IF;
  -- Remove I, O, Q per ISO 3779; uppercase
  RETURN UPPER(REGEXP_REPLACE(raw, '[IOQ]', '', 'gi'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Validation:**
```sql
CHECK (vin ~ '^[A-HJ-NPR-Z0-9]{11,17}$')
```

---

## Empty/Optional Columns

**HIGH Unknown Rate (>80% empty):**
- Day of Week
- Sale time (HHMM)
- Body Style
- Special Note
- Rentals
- Copart Select
- Seller Name
- Offsite Address/City/State/Zip (entire offsite group)
- Sale Light
- AutoGrade
- Announcements

**Handling:** Store in JSONB payload; do not create dedicated columns unless usage increases

---

## Alias Map (for JSONB queries)

**Quick Reference (CSV name → canonical):**
```json
{
  "Lot number": "lot_external_id",
  "VIN": "vin_raw",
  "Last Updated Time": "source_updated_at",
  "Yard number": "yard_number",
  "Yard name": "yard_name",
  "Sale Status": "status",
  "High Bid =non-vix,Sealed=Vix": "current_bid_usd",
  "Damage Description": "damage_primary",
  "Location city": "location_city",
  "Location state": "location_state",
  "Odometer": "odometer",
  "Est. Retail Value": "retail_value_usd"
}
```

---

## Taxonomy Domains (Limited Vocabularies)

**Damage Description** (damage_primary)
- Expected values: "WATER/FLOOD", "REAR END", "FRONT END", "MECHANICAL", "NORMAL WEAR", etc.
- **Action:** Build lookup table in MS-S1-04

**Sale Title Type** (title_type)
- Expected values: "NR" (non-repairable), "SC" (salvage certificate), "CT" (certificate of title), etc.
- **Action:** Build lookup table in MS-S1-04

**Sale Status** (status)
- Expected values: "Pure Sale", "On Minimum Bid", "Sold", "Future Sale", etc.
- **Action:** Build lookup table in MS-S1-04

**Odometer Brand** (odometer_brand)
- Expected values: "A" (actual), "E" (exempt), "N" (not actual), "T" (TMU - true mileage unknown)

---

## Unmapped/Future Columns

**Deferred to S2+:**
- Item# (unclear purpose; often 0)
- Sale Date M/D/CY (format unclear; often 0)
- Grid/Row (physical location; low priority)
- Offsite fields (rarely populated)

---

## Change Log

**2025-10-16 (S1 Initial Mapping):**
- Created v1 mapping for 59 columns
- Identified key fields: lot_external_id, vin_raw, source_updated_at
- Defined type conversions and VIN normalization
- Flagged 10-12 empty columns for JSONB-only storage

---

**Next Steps:**
1. Implement type conversion logic in ETL parser
2. Build taxonomy lookup tables (MS-S1-04)
3. Test VIN normalization function
4. Create CSV_VOLUME_SUMMARY.md with coverage stats
