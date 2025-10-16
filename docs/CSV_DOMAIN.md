# CSV Domain — Normalization & Display Handlers

**Purpose:** Define normalization rules and transformations for Copart CSV raw values → canonical database codes → user-facing display (EN/RU)
**Sprint:** S1B — ETL ingest & normalization
**Date:** 2025-10-16
**Status:** 📋 PLANNING

---

## Overview

The CSV Domain layer sits between raw CSV ingestion and user-facing API/SSR. It performs three key functions:

1. **Normalization:** Convert raw CSV strings to canonical codes
2. **Validation:** Ensure values conform to expected domains
3. **Localization:** Map canonical codes to EN/RU display labels

**Flow:**
```
CSV Raw → Normalizer → DB Code → Taxonomy Lookup → Display Label (EN/RU)
```

**Example:**
```
"WATER/FLOOD" → normalize_damage() → "damage_flood" → taxonomies.damage_types → {en: "Water/Flood Damage", ru: "Повреждение водой/наводнением"}
```

---

## Normalization Domains

### 1. Damage Types (damage_primary, damage_secondary)

**CSV Column:** "Damage Description", "Secondary Damage"
**Target:** `lots.damage_primary`, `lots.damage_secondary`
**Type:** TEXT (canonical code)
**Unknown Rate:** 0.1% (mostly populated)

**Common Values (from CSV analysis):**
```
WATER/FLOOD         → damage_flood
REAR END            → damage_rear_end
FRONT END           → damage_front_end
MECHANICAL          → damage_mechanical
NORMAL WEAR         → damage_normal_wear
MINOR DENT/SCRATCHES → damage_minor_dent
ALL OVER            → damage_all_over
HAIL DAMAGE         → damage_hail
UNDERCARRIAGE       → damage_undercarriage
SIDE                → damage_side
FRAME DAMAGE        → damage_frame
BURN - ENGINE       → damage_burn_engine
BURN - INTERIOR     → damage_burn_interior
VANDALISM           → damage_vandalism
BIOHAZARD/CHEM      → damage_biohazard
TOP/ROOF            → damage_roof
ROLLOVER            → damage_rollover
```

**Normalization Function:**
```javascript
function normalizeDamage(raw) {
  if (!raw || raw.trim() === '') return null;

  const upper = raw.toUpperCase().trim();

  // Direct mappings
  const mappings = {
    'WATER/FLOOD': 'damage_flood',
    'REAR END': 'damage_rear_end',
    'FRONT END': 'damage_front_end',
    'MECHANICAL': 'damage_mechanical',
    'NORMAL WEAR': 'damage_normal_wear',
    'MINOR DENT/SCRATCHES': 'damage_minor_dent',
    'ALL OVER': 'damage_all_over',
    'HAIL DAMAGE': 'damage_hail',
    'UNDERCARRIAGE': 'damage_undercarriage',
    'SIDE': 'damage_side',
    'FRAME DAMAGE': 'damage_frame',
    'BURN - ENGINE': 'damage_burn_engine',
    'BURN - INTERIOR': 'damage_burn_interior',
    'VANDALISM': 'damage_vandalism',
    'BIOHAZARD/CHEM': 'damage_biohazard',
    'TOP/ROOF': 'damage_roof',
    'ROLLOVER': 'damage_rollover',
  };

  if (mappings[upper]) return mappings[upper];

  // Log unknown for review
  logUnknownTaxonomy('damage_types', raw);

  // Return sanitized raw value as fallback
  return 'damage_unknown_' + raw.toLowerCase().replace(/[^a-z0-9]/g, '_');
}
```

**Edge Cases:**
- Empty string → NULL
- Multiple damages (e.g., "FRONT END/REAR END") → Split and take first
- Typos/variants → Log unknown, return fallback code

---

### 2. Title Types (title_type)

**CSV Column:** "Sale Title Type"
**Target:** `lots.title_type`
**Type:** TEXT (canonical code)
**Unknown Rate:** 5% (mostly populated)

**Common Values:**
```
NR  → title_non_repairable
SC  → title_salvage_certificate
CT  → title_certificate_of_title
SV  → title_salvage
RB  → title_rebuilt
CL  → title_clear
JK  → title_junk
PR  → title_parts_only
BN  → title_bond_title
WT  → title_certificate_of_destruction
```

**Normalization Function:**
```javascript
function normalizeTitleType(raw) {
  if (!raw || raw.trim() === '') return null;

  const upper = raw.toUpperCase().trim();

  const mappings = {
    'NR': 'title_non_repairable',
    'SC': 'title_salvage_certificate',
    'CT': 'title_certificate_of_title',
    'SV': 'title_salvage',
    'RB': 'title_rebuilt',
    'CL': 'title_clear',
    'JK': 'title_junk',
    'PR': 'title_parts_only',
    'BN': 'title_bond_title',
    'WT': 'title_certificate_of_destruction',
  };

  if (mappings[upper]) return mappings[upper];

  logUnknownTaxonomy('title_types', raw);
  return 'title_unknown_' + upper.toLowerCase();
}
```

---

### 3. Sale Status (status)

**CSV Column:** "Sale Status"
**Target:** `lots.status`
**Type:** TEXT (canonical code)
**Unknown Rate:** 0% (always present)

**Common Values:**
```
Pure Sale           → status_active
On Minimum Bid      → status_active
Sold                → status_sold
Future Sale         → status_scheduled
Pending Sale        → status_scheduled
On Hold             → status_on_hold
Cancelled           → status_cancelled
```

**Normalization Function:**
```javascript
function normalizeStatus(raw) {
  if (!raw || raw.trim() === '') return 'status_unknown';

  const upper = raw.toUpperCase().trim();

  const mappings = {
    'PURE SALE': 'status_active',
    'ON MINIMUM BID': 'status_active',
    'SOLD': 'status_sold',
    'FUTURE SALE': 'status_scheduled',
    'PENDING SALE': 'status_scheduled',
    'ON HOLD': 'status_on_hold',
    'CANCELLED': 'status_cancelled',
  };

  if (mappings[upper]) return mappings[upper];

  logUnknownTaxonomy('statuses', raw);
  return 'status_unknown';
}
```

**Note:** This is separate from internal lifecycle status (PENDING_RESULT), which is set by the completion detector.

---

### 4. Odometer Brand (odometer_brand)

**CSV Column:** "Odometer Brand"
**Target:** `lots.odometer_brand`
**Type:** TEXT (canonical code)
**Unknown Rate:** 2% (mostly populated)

**Common Values:**
```
A   → odometer_actual
E   → odometer_exempt
N   → odometer_not_actual
T   → odometer_tmu           (True Mileage Unknown)
R   → odometer_replaced
M   → odometer_mechanical
```

**Normalization Function:**
```javascript
function normalizeOdometerBrand(raw) {
  if (!raw || raw.trim() === '') return null;

  const upper = raw.toUpperCase().trim();

  const mappings = {
    'A': 'odometer_actual',
    'E': 'odometer_exempt',
    'N': 'odometer_not_actual',
    'T': 'odometer_tmu',
    'R': 'odometer_replaced',
    'M': 'odometer_mechanical',
  };

  if (mappings[upper]) return mappings[upper];

  logUnknownTaxonomy('odometer_brands', raw);
  return 'odometer_unknown';
}
```

---

### 5. Body Styles (body)

**CSV Column:** "Body Style"
**Target:** `vehicles.body`
**Type:** TEXT (canonical code)
**Unknown Rate:** 85% (rarely populated)

**Common Values:**
```
SEDAN           → body_sedan
SUV             → body_suv
TRUCK           → body_pickup_truck
VAN             → body_van
COUPE           → body_coupe
CONVERTIBLE     → body_convertible
HATCHBACK       → body_hatchback
WAGON           → body_wagon
CROSSOVER       → body_crossover
```

**Normalization Function:**
```javascript
function normalizeBody(raw) {
  if (!raw || raw.trim() === '') return null;

  const upper = raw.toUpperCase().trim();

  const mappings = {
    'SEDAN': 'body_sedan',
    'SUV': 'body_suv',
    'TRUCK': 'body_pickup_truck',
    'VAN': 'body_van',
    'COUPE': 'body_coupe',
    'CONVERTIBLE': 'body_convertible',
    'HATCHBACK': 'body_hatchback',
    'WAGON': 'body_wagon',
    'CROSSOVER': 'body_crossover',
  };

  if (mappings[upper]) return mappings[upper];

  // Fuzzy matching for common variants
  if (upper.includes('SEDAN')) return 'body_sedan';
  if (upper.includes('SUV') || upper.includes('SPORT UTILITY')) return 'body_suv';
  if (upper.includes('TRUCK') || upper.includes('PICKUP')) return 'body_pickup_truck';

  logUnknownTaxonomy('body_styles', raw);
  return null;  // Accept NULL for unknown body styles
}
```

---

### 6. Fuel Types (fuel)

**CSV Column:** "Fuel Type"
**Target:** `vehicles.fuel`
**Type:** TEXT (canonical code)
**Unknown Rate:** 15% (mostly populated)

**Common Values:**
```
GAS             → fuel_gasoline
DIESEL          → fuel_diesel
HYBRID          → fuel_hybrid
ELECTRIC        → fuel_electric
FLEX FUEL       → fuel_flex_fuel
PLUG-IN HYBRID  → fuel_plug_in_hybrid
HYDROGEN        → fuel_hydrogen
CNG             → fuel_cng             (Compressed Natural Gas)
```

**Normalization Function:**
```javascript
function normalizeFuel(raw) {
  if (!raw || raw.trim() === '') return null;

  const upper = raw.toUpperCase().trim();

  const mappings = {
    'GAS': 'fuel_gasoline',
    'GASOLINE': 'fuel_gasoline',
    'DIESEL': 'fuel_diesel',
    'HYBRID': 'fuel_hybrid',
    'ELECTRIC': 'fuel_electric',
    'FLEX FUEL': 'fuel_flex_fuel',
    'PLUG-IN HYBRID': 'fuel_plug_in_hybrid',
    'HYDROGEN': 'fuel_hydrogen',
    'CNG': 'fuel_cng',
  };

  if (mappings[upper]) return mappings[upper];

  logUnknownTaxonomy('fuel_types', raw);
  return null;
}
```

---

### 7. Transmission Types (transmission)

**CSV Column:** "Transmission"
**Target:** `vehicles.transmission`
**Type:** TEXT (canonical code)
**Unknown Rate:** 10% (mostly populated)

**Common Values:**
```
AUTOMATIC       → transmission_automatic
MANUAL          → transmission_manual
CVT             → transmission_cvt
DCT             → transmission_dct          (Dual-Clutch)
```

**Normalization Function:**
```javascript
function normalizeTransmission(raw) {
  if (!raw || raw.trim() === '') return null;

  const upper = raw.toUpperCase().trim();

  const mappings = {
    'AUTOMATIC': 'transmission_automatic',
    'MANUAL': 'transmission_manual',
    'CVT': 'transmission_cvt',
    'DCT': 'transmission_dct',
  };

  if (mappings[upper]) return mappings[upper];

  // Fuzzy matching
  if (upper.includes('AUTO')) return 'transmission_automatic';
  if (upper.includes('MANUAL') || upper.includes('MT')) return 'transmission_manual';

  logUnknownTaxonomy('transmission_types', raw);
  return null;
}
```

---

### 8. Drive Types (drive)

**CSV Column:** "Drive"
**Target:** `vehicles.drive`
**Type:** TEXT (canonical code)
**Unknown Rate:** 10% (mostly populated)

**Common Values:**
```
FWD     → drive_fwd       (Front-Wheel Drive)
RWD     → drive_rwd       (Rear-Wheel Drive)
AWD     → drive_awd       (All-Wheel Drive)
4WD     → drive_4wd       (Four-Wheel Drive)
```

**Normalization Function:**
```javascript
function normalizeDrive(raw) {
  if (!raw || raw.trim() === '') return null;

  const upper = raw.toUpperCase().trim();

  const mappings = {
    'FWD': 'drive_fwd',
    'RWD': 'drive_rwd',
    'AWD': 'drive_awd',
    '4WD': 'drive_4wd',
  };

  if (mappings[upper]) return mappings[upper];

  logUnknownTaxonomy('drive_types', raw);
  return null;
}
```

---

### 9. Colors (color)

**CSV Column:** "Color"
**Target:** `vehicles.color`
**Type:** TEXT (canonical code)
**Unknown Rate:** 5% (mostly populated)

**Common Values:**
```
BLACK       → color_black
WHITE       → color_white
SILVER      → color_silver
GRAY        → color_gray
BLUE        → color_blue
RED         → color_red
GREEN       → color_green
BEIGE       → color_beige
BROWN       → color_brown
GOLD        → color_gold
YELLOW      → color_yellow
ORANGE      → color_orange
PURPLE      → color_purple
```

**Normalization Function:**
```javascript
function normalizeColor(raw) {
  if (!raw || raw.trim() === '') return null;

  const upper = raw.toUpperCase().trim();

  const mappings = {
    'BLACK': 'color_black',
    'WHITE': 'color_white',
    'SILVER': 'color_silver',
    'GRAY': 'color_gray',
    'GREY': 'color_gray',
    'BLUE': 'color_blue',
    'RED': 'color_red',
    'GREEN': 'color_green',
    'BEIGE': 'color_beige',
    'BROWN': 'color_brown',
    'GOLD': 'color_gold',
    'YELLOW': 'color_yellow',
    'ORANGE': 'color_orange',
    'PURPLE': 'color_purple',
  };

  if (mappings[upper]) return mappings[upper];

  // Handle compound colors (e.g., "DARK BLUE" → "BLUE")
  for (const [key, value] of Object.entries(mappings)) {
    if (upper.includes(key)) return value;
  }

  logUnknownTaxonomy('colors', raw);
  return 'color_other';
}
```

---

## Unknown Value Handling

### Strategy

**Philosophy:** Graceful degradation — display raw value if unmapped, log for review

**Implementation:**
1. **Normalization:** If mapping not found → generate fallback code
2. **Logging:** Insert into `audit.unknown_taxonomy_values` table
3. **Display:** Return raw value wrapped in code (e.g., `damage_unknown_custom_value`)
4. **Review:** Periodic review of unknowns → add to taxonomies

**Audit Table Schema:**
```sql
CREATE TABLE audit.unknown_taxonomy_values (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL,           -- e.g., 'damage_types'
  raw_value TEXT NOT NULL,
  occurrence_count INT DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(domain, raw_value)
);
```

**Logging Function:**
```javascript
async function logUnknownTaxonomy(domain, rawValue) {
  await db.query(`
    INSERT INTO audit.unknown_taxonomy_values (domain, raw_value, occurrence_count, last_seen_at)
    VALUES ($1, $2, 1, now())
    ON CONFLICT (domain, raw_value)
    DO UPDATE SET
      occurrence_count = audit.unknown_taxonomy_values.occurrence_count + 1,
      last_seen_at = now()
  `, [domain, rawValue]);
}
```

**Review Process:**
1. Weekly: Query unknowns with `occurrence_count >10`
2. Research: Determine if value is valid/common
3. Update: Add to taxonomies lookup table
4. Re-ingest: Historical data retroactively normalized (optional)

---

## Type Conversions

### Boolean Fields

**has_keys:**
- CSV: "YES" | "NO" | ""
- DB: BOOLEAN (TRUE | FALSE | NULL)
```javascript
function parseBoolean(raw) {
  if (!raw || raw.trim() === '') return null;
  const upper = raw.toUpperCase().trim();
  if (upper === 'YES' || upper === 'Y') return true;
  if (upper === 'NO' || upper === 'N') return false;
  return null;
}
```

**runs_drives:**
- CSV: "YES" | "NO" | "UNKNOWN" | ""
- DB: TEXT (canonical code)
```javascript
function normalizeRunsDrives(raw) {
  if (!raw || raw.trim() === '') return null;
  const upper = raw.toUpperCase().trim();
  if (upper === 'YES') return 'runs_drives_yes';
  if (upper === 'NO') return 'runs_drives_no';
  if (upper === 'UNKNOWN') return 'runs_drives_unknown';
  return 'runs_drives_unknown';
}
```

### Numeric Fields

**Odometer:**
- CSV: "123456" (can have commas or decimals)
- DB: NUMERIC(10,1)
```javascript
function parseOdometer(raw) {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.replace(/[,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
```

**Retail Value:**
- CSV: "12500.00" (USD)
- DB: NUMERIC(12,2)
```javascript
function parseRetailValue(raw) {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) || num < 0 ? null : num;
}
```

### Timestamp Fields

**Last Updated Time:**
- CSV: "2025-10-14T07:01:00Z" (ISO 8601)
- DB: TIMESTAMPTZ
```javascript
function parseLastUpdated(raw) {
  if (!raw || raw.trim() === '') return null;
  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date;
}
```

**Create Date/Time:**
- CSV: "2025-10-14-08.55.06.000795" (non-standard)
- DB: TIMESTAMPTZ
```javascript
function parseCreateDateTime(raw) {
  if (!raw || raw.trim() === '') return null;

  // Format: YYYY-MM-DD-HH.mm.ss.microseconds
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  const date = new Date(isoString);
  return isNaN(date.getTime()) ? null : date;
}
```

---

## Validation Rules

### VIN Validation

**Rule:** 11-17 characters, uppercase, exclude I/O/Q
**Regex:** `^[A-HJ-NPR-Z0-9]{11,17}$`

```javascript
function validateVIN(vin) {
  if (!vin || vin.trim() === '') return { valid: false, reason: 'empty' };

  const normalized = vin.toUpperCase().trim();
  const regex = /^[A-HJ-NPR-Z0-9]{11,17}$/;

  if (!regex.test(normalized)) {
    return { valid: false, reason: 'invalid_format', vin: normalized };
  }

  return { valid: true, vin: normalized };
}
```

### Year Validation

**Rule:** 1900-2100 (allow future years for pre-release models)

```javascript
function validateYear(year) {
  const num = parseInt(year, 10);
  if (isNaN(num)) return { valid: false, reason: 'not_a_number' };
  if (num < 1900 || num > 2100) return { valid: false, reason: 'out_of_range' };
  return { valid: true, year: num };
}
```

### Lot External ID Validation

**Rule:** NOT NULL, alphanumeric with hyphens allowed

```javascript
function validateLotExternalID(lotID) {
  if (!lotID || lotID.trim() === '') return { valid: false, reason: 'empty' };

  const cleaned = lotID.trim();
  const regex = /^[A-Za-z0-9\-]+$/;

  if (!regex.test(cleaned)) {
    return { valid: false, reason: 'invalid_format' };
  }

  return { valid: true, lotID: cleaned };
}
```

---

## Reusable Normalizer Module

**Location:** `scripts/lib/csv-normalizer.js`

**Exports:**
```javascript
module.exports = {
  // Normalization functions
  normalizeDamage,
  normalizeTitleType,
  normalizeStatus,
  normalizeOdometerBrand,
  normalizeBody,
  normalizeFuel,
  normalizeTransmission,
  normalizeDrive,
  normalizeColor,
  normalizeRunsDrives,

  // Type conversions
  parseBoolean,
  parseOdometer,
  parseRetailValue,
  parseLastUpdated,
  parseCreateDateTime,

  // Validation
  validateVIN,
  validateYear,
  validateLotExternalID,

  // Unknown logging
  logUnknownTaxonomy,
};
```

**Usage in ETL:**
```javascript
const normalizer = require('./lib/csv-normalizer');

// Example row processing
const normalized = {
  vin: normalizer.validateVIN(row['VIN']).vin,
  year: normalizer.validateYear(row['Year']).year,
  damage_primary: normalizer.normalizeDamage(row['Damage Description']),
  title_type: normalizer.normalizeTitleType(row['Sale Title Type']),
  status: normalizer.normalizeStatus(row['Sale Status']),
  odometer: normalizer.parseOdometer(row['Odometer']),
  source_updated_at: normalizer.parseLastUpdated(row['Last Updated Time']),
};
```

---

## Testing Strategy

### Unit Tests

**Location:** `tests/unit/csv-normalizer.test.js`

**Test Cases:**
1. **Valid inputs:** Common CSV values → correct canonical codes
2. **Empty inputs:** NULL/empty string → NULL (not error)
3. **Unknown values:** Unmapped value → fallback code + logged
4. **Fuzzy matching:** Variants (e.g., "DARK BLUE") → correct code
5. **Edge cases:** Special characters, extra whitespace, mixed case

**Example:**
```javascript
describe('normalizeDamage', () => {
  it('maps WATER/FLOOD to damage_flood', () => {
    expect(normalizeDamage('WATER/FLOOD')).toBe('damage_flood');
  });

  it('handles empty string', () => {
    expect(normalizeDamage('')).toBeNull();
  });

  it('logs unknown values', () => {
    const spy = jest.spyOn(logger, 'logUnknownTaxonomy');
    normalizeDamage('CUSTOM_DAMAGE');
    expect(spy).toHaveBeenCalledWith('damage_types', 'CUSTOM_DAMAGE');
  });
});
```

### Integration Tests

**Location:** `tests/integration/csv-domain-e2e.test.js`

**Test Cases:**
1. **Full row normalization:** CSV row → normalized object
2. **Batch processing:** 1000 rows → all normalized (no errors)
3. **Unknown logging:** After batch → audit table populated
4. **Idempotency:** Re-normalizing same row → same output

---

## Performance Considerations

**Optimization:**
- Use `Map` for lookups (O(1) vs O(n) for object iteration)
- Cache taxonomy lookups in memory (refresh every 5 minutes)
- Batch unknown logging (insert every 100 rows, not per row)

**Benchmarks:**
- Normalize single row: <0.1ms
- Normalize 150K rows: <15 seconds
- Taxonomy lookup: <0.01ms (from cache)

---

## Change Log

**2025-10-16 (v1.0 — Planning):**
- Defined 9 normalization domains (damage, title, status, odometer, body, fuel, transmission, drive, color)
- Specified unknown value handling strategy
- Created reusable normalizer module design
- Documented type conversions and validation rules

---

**Next Steps:**
1. Implement `scripts/lib/csv-normalizer.js`
2. Create unit tests (`tests/unit/csv-normalizer.test.js`)
3. Build taxonomy lookup tables (migration 0011)
4. Seed initial EN/RU translations (see TAXONOMIES_RU_EN.md)
5. Integrate normalizer into upsert procedures

---

**Status:** 📋 PLANNING COMPLETE — Ready for implementation
