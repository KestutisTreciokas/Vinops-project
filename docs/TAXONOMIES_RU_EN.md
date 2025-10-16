# Taxonomies — RU/EN Bilingual Mappings

**Purpose:** Define bilingual (Russian/English) translations for all taxonomy domains used in CSV normalization and user-facing displays
**Sprint:** S1B — ETL ingest & normalization
**Date:** 2025-10-16
**Status:** 📋 PLANNING

---

## Overview

Taxonomy tables store canonical codes with English and Russian display labels. This enables:

1. **Consistent codes:** Database stores stable codes (e.g., `damage_flood`)
2. **Localized display:** API/SSR returns appropriate language label
3. **Easy translation:** Update labels without changing application code

**Schema Pattern:**
```sql
CREATE TABLE taxonomies.<domain> (
  code TEXT PRIMARY KEY,
  en TEXT NOT NULL,
  ru TEXT NOT NULL,
  category TEXT,              -- Optional grouping
  sort_order INT DEFAULT 999,
  deprecated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**API Response Pattern:**
```json
{
  "damage_primary": {
    "code": "damage_flood",
    "label": {
      "en": "Water/Flood Damage",
      "ru": "Повреждение водой/наводнением"
    }
  }
}
```

---

## Taxonomy Tables

### 1. Damage Types (`taxonomies.damage_types`)

**Purpose:** Primary and secondary damage classifications

| code | en | ru | category |
|------|----|----|----------|
| `damage_flood` | Water/Flood Damage | Повреждение водой/наводнением | water |
| `damage_rear_end` | Rear End Damage | Повреждение задней части | collision |
| `damage_front_end` | Front End Damage | Повреждение передней части | collision |
| `damage_mechanical` | Mechanical Damage | Механические повреждения | mechanical |
| `damage_normal_wear` | Normal Wear | Нормальный износ | wear |
| `damage_minor_dent` | Minor Dents/Scratches | Небольшие вмятины/царапины | wear |
| `damage_all_over` | All Over Damage | Повреждения по всему кузову | collision |
| `damage_hail` | Hail Damage | Повреждение градом | weather |
| `damage_undercarriage` | Undercarriage Damage | Повреждение днища | mechanical |
| `damage_side` | Side Damage | Боковое повреждение | collision |
| `damage_frame` | Frame Damage | Повреждение рамы | structural |
| `damage_burn_engine` | Burn — Engine | Возгорание двигателя | fire |
| `damage_burn_interior` | Burn — Interior | Возгорание салона | fire |
| `damage_vandalism` | Vandalism | Вандализм | other |
| `damage_biohazard` | Biohazard/Chemical | Биологическая/химическая опасность | other |
| `damage_roof` | Top/Roof Damage | Повреждение крыши | structural |
| `damage_rollover` | Rollover Damage | Опрокидывание | collision |
| `damage_unknown` | Unknown Damage | Неизвестное повреждение | other |

**Categories:**
- `water` — Water-related damage
- `collision` — Impact damage
- `mechanical` — Mechanical failures
- `wear` — Normal wear and tear
- `weather` — Weather-related damage
- `fire` — Fire damage
- `structural` — Frame/structural damage
- `other` — Miscellaneous

---

### 2. Title Types (`taxonomies.title_types`)

**Purpose:** Vehicle title status classifications

| code | en | ru | category |
|------|----|----|----------|
| `title_non_repairable` | Non-Repairable (NR) | Не подлежит ремонту (NR) | salvage |
| `title_salvage_certificate` | Salvage Certificate (SC) | Свидетельство об утилизации (SC) | salvage |
| `title_certificate_of_title` | Certificate of Title (CT) | Свидетельство о праве собственности (CT) | clear |
| `title_salvage` | Salvage (SV) | Утилизация (SV) | salvage |
| `title_rebuilt` | Rebuilt (RB) | Восстановленный (RB) | rebuilt |
| `title_clear` | Clear Title (CL) | Чистый титул (CL) | clear |
| `title_junk` | Junk (JK) | На запчасти (JK) | salvage |
| `title_parts_only` | Parts Only (PR) | Только запчасти (PR) | salvage |
| `title_bond_title` | Bond Title (BN) | Титул под залогом (BN) | special |
| `title_certificate_of_destruction` | Certificate of Destruction (WT) | Свидетельство об уничтожении (WT) | salvage |
| `title_unknown` | Unknown Title | Неизвестный титул | other |

**Categories:**
- `clear` — Clear/clean titles
- `salvage` — Salvage/junk titles
- `rebuilt` — Rebuilt/restored titles
- `special` — Special title types
- `other` — Unknown or miscellaneous

---

### 3. Lot Statuses (`taxonomies.statuses`)

**Purpose:** Auction/sale status classifications

| code | en | ru | category |
|------|----|----|----------|
| `status_active` | Active for Sale | Активный лот | active |
| `status_scheduled` | Scheduled/Future Sale | Запланирован | future |
| `status_sold` | Sold | Продан | closed |
| `status_on_hold` | On Hold | На удержании | paused |
| `status_cancelled` | Cancelled | Отменён | closed |
| `status_pending_result` | Pending Result | Ожидание результата | pending |
| `status_unknown` | Unknown Status | Неизвестный статус | other |

**Categories:**
- `active` — Currently available for bidding
- `future` — Not yet available for bidding
- `closed` — No longer available (sold/cancelled)
- `paused` — Temporarily unavailable
- `pending` — Awaiting final status
- `other` — Unknown or error state

**Note:** `status_pending_result` is set by the completion detector (internal lifecycle), not from CSV.

---

### 4. Odometer Brands (`taxonomies.odometer_brands`)

**Purpose:** Odometer reading reliability classifications

| code | en | ru | category |
|------|----|----|----------|
| `odometer_actual` | Actual Mileage | Фактический пробег | reliable |
| `odometer_exempt` | Exempt from Reporting | Освобождён от отчётности | exempt |
| `odometer_not_actual` | Not Actual Mileage | Не фактический пробег | unreliable |
| `odometer_tmu` | True Mileage Unknown (TMU) | Настоящий пробег неизвестен | unreliable |
| `odometer_replaced` | Odometer Replaced | Одометр заменён | unreliable |
| `odometer_mechanical` | Mechanical Odometer | Механический одометр | other |
| `odometer_unknown` | Unknown | Неизвестно | other |

**Categories:**
- `reliable` — Trustworthy mileage
- `exempt` — Legal exemptions (e.g., commercial vehicles)
- `unreliable` — Mileage may not be accurate
- `other` — Miscellaneous or unknown

---

### 5. Body Styles (`taxonomies.body_styles`)

**Purpose:** Vehicle body type classifications

| code | en | ru | category |
|------|----|----|----------|
| `body_sedan` | Sedan | Седан | passenger |
| `body_suv` | SUV | Внедорожник | suv |
| `body_pickup_truck` | Pickup Truck | Пикап | truck |
| `body_van` | Van | Фургон | commercial |
| `body_coupe` | Coupe | Купе | passenger |
| `body_convertible` | Convertible | Кабриолет | passenger |
| `body_hatchback` | Hatchback | Хэтчбек | passenger |
| `body_wagon` | Wagon | Универсал | passenger |
| `body_crossover` | Crossover | Кроссовер | suv |

**Categories:**
- `passenger` — Passenger cars
- `suv` — SUVs and crossovers
- `truck` — Pickup trucks
- `commercial` — Commercial vehicles

---

### 6. Fuel Types (`taxonomies.fuel_types`)

**Purpose:** Vehicle fuel/energy source classifications

| code | en | ru | category |
|------|----|----|----------|
| `fuel_gasoline` | Gasoline | Бензин | fossil |
| `fuel_diesel` | Diesel | Дизель | fossil |
| `fuel_hybrid` | Hybrid | Гибрид | alternative |
| `fuel_electric` | Electric | Электрический | alternative |
| `fuel_flex_fuel` | Flex Fuel | Многотопливный | fossil |
| `fuel_plug_in_hybrid` | Plug-in Hybrid | Подключаемый гибрид | alternative |
| `fuel_hydrogen` | Hydrogen | Водород | alternative |
| `fuel_cng` | CNG (Compressed Natural Gas) | СПГ (сжатый природный газ) | alternative |

**Categories:**
- `fossil` — Traditional fossil fuels
- `alternative` — Alternative/clean energy

---

### 7. Transmission Types (`taxonomies.transmission_types`)

**Purpose:** Vehicle transmission classifications

| code | en | ru | category |
|------|----|----|----------|
| `transmission_automatic` | Automatic | Автоматическая | automatic |
| `transmission_manual` | Manual | Механическая | manual |
| `transmission_cvt` | CVT (Continuously Variable) | CVT (бесступенчатая) | automatic |
| `transmission_dct` | DCT (Dual-Clutch) | DCT (с двойным сцеплением) | automatic |

**Categories:**
- `automatic` — Automatic transmissions (including CVT/DCT)
- `manual` — Manual transmissions

---

### 8. Drive Types (`taxonomies.drive_types`)

**Purpose:** Vehicle drivetrain classifications

| code | en | ru | category |
|------|----|----|----------|
| `drive_fwd` | Front-Wheel Drive (FWD) | Передний привод (FWD) | 2wd |
| `drive_rwd` | Rear-Wheel Drive (RWD) | Задний привод (RWD) | 2wd |
| `drive_awd` | All-Wheel Drive (AWD) | Полный привод (AWD) | 4wd |
| `drive_4wd` | Four-Wheel Drive (4WD) | Полный привод (4WD) | 4wd |

**Categories:**
- `2wd` — Two-wheel drive
- `4wd` — Four-wheel drive / All-wheel drive

---

### 9. Colors (`taxonomies.colors`)

**Purpose:** Vehicle exterior color classifications

| code | en | ru | category |
|------|----|----|----------|
| `color_black` | Black | Чёрный | neutral |
| `color_white` | White | Белый | neutral |
| `color_silver` | Silver | Серебристый | neutral |
| `color_gray` | Gray | Серый | neutral |
| `color_blue` | Blue | Синий | cool |
| `color_red` | Red | Красный | warm |
| `color_green` | Green | Зелёный | cool |
| `color_beige` | Beige | Бежевый | neutral |
| `color_brown` | Brown | Коричневый | warm |
| `color_gold` | Gold | Золотой | warm |
| `color_yellow` | Yellow | Жёлтый | warm |
| `color_orange` | Orange | Оранжевый | warm |
| `color_purple` | Purple | Фиолетовый | cool |
| `color_other` | Other | Другой | other |

**Categories:**
- `neutral` — Black, white, gray, silver, beige
- `warm` — Red, orange, yellow, gold, brown
- `cool` — Blue, green, purple
- `other` — Uncommon or custom colors

---

### 10. Runs/Drives Status (`taxonomies.runs_drives_status`)

**Purpose:** Vehicle drivability classifications

| code | en | ru | category |
|------|----|----|----------|
| `runs_drives_yes` | Runs and Drives | Заводится и едет | operational |
| `runs_drives_no` | Does Not Run or Drive | Не заводится/не едет | non_operational |
| `runs_drives_unknown` | Unknown | Неизвестно | unknown |

**Categories:**
- `operational` — Vehicle is drivable
- `non_operational` — Vehicle is not drivable
- `unknown` — Drivability not tested or unknown

---

## Database Schema

### Migration: `db/migrations/0011_taxonomies.sql`

```sql
-- Create taxonomies schema
CREATE SCHEMA IF NOT EXISTS taxonomies;

-- Helper function to create taxonomy tables with standard structure
CREATE OR REPLACE FUNCTION create_taxonomy_table(table_name TEXT) RETURNS VOID AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS taxonomies.%I (
      code TEXT PRIMARY KEY,
      en TEXT NOT NULL,
      ru TEXT NOT NULL,
      category TEXT,
      sort_order INT DEFAULT 999,
      deprecated BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT %I_code_format_ck CHECK (code ~ ''^[a-z_]+$'')
    )
  ', table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Create all taxonomy tables
SELECT create_taxonomy_table('damage_types');
SELECT create_taxonomy_table('title_types');
SELECT create_taxonomy_table('statuses');
SELECT create_taxonomy_table('odometer_brands');
SELECT create_taxonomy_table('body_styles');
SELECT create_taxonomy_table('fuel_types');
SELECT create_taxonomy_table('transmission_types');
SELECT create_taxonomy_table('drive_types');
SELECT create_taxonomy_table('colors');
SELECT create_taxonomy_table('runs_drives_status');

-- Seed damage types
INSERT INTO taxonomies.damage_types (code, en, ru, category, sort_order) VALUES
  ('damage_flood', 'Water/Flood Damage', 'Повреждение водой/наводнением', 'water', 1),
  ('damage_rear_end', 'Rear End Damage', 'Повреждение задней части', 'collision', 2),
  ('damage_front_end', 'Front End Damage', 'Повреждение передней части', 'collision', 3),
  ('damage_mechanical', 'Mechanical Damage', 'Механические повреждения', 'mechanical', 4),
  ('damage_normal_wear', 'Normal Wear', 'Нормальный износ', 'wear', 5),
  ('damage_minor_dent', 'Minor Dents/Scratches', 'Небольшие вмятины/царапины', 'wear', 6),
  ('damage_all_over', 'All Over Damage', 'Повреждения по всему кузову', 'collision', 7),
  ('damage_hail', 'Hail Damage', 'Повреждение градом', 'weather', 8),
  ('damage_undercarriage', 'Undercarriage Damage', 'Повреждение днища', 'mechanical', 9),
  ('damage_side', 'Side Damage', 'Боковое повреждение', 'collision', 10),
  ('damage_frame', 'Frame Damage', 'Повреждение рамы', 'structural', 11),
  ('damage_burn_engine', 'Burn — Engine', 'Возгорание двигателя', 'fire', 12),
  ('damage_burn_interior', 'Burn — Interior', 'Возгорание салона', 'fire', 13),
  ('damage_vandalism', 'Vandalism', 'Вандализм', 'other', 14),
  ('damage_biohazard', 'Biohazard/Chemical', 'Биологическая/химическая опасность', 'other', 15),
  ('damage_roof', 'Top/Roof Damage', 'Повреждение крыши', 'structural', 16),
  ('damage_rollover', 'Rollover Damage', 'Опрокидывание', 'collision', 17),
  ('damage_unknown', 'Unknown Damage', 'Неизвестное повреждение', 'other', 999);

-- Seed title types
INSERT INTO taxonomies.title_types (code, en, ru, category, sort_order) VALUES
  ('title_clear', 'Clear Title (CL)', 'Чистый титул (CL)', 'clear', 1),
  ('title_certificate_of_title', 'Certificate of Title (CT)', 'Свидетельство о праве собственности (CT)', 'clear', 2),
  ('title_salvage', 'Salvage (SV)', 'Утилизация (SV)', 'salvage', 3),
  ('title_salvage_certificate', 'Salvage Certificate (SC)', 'Свидетельство об утилизации (SC)', 'salvage', 4),
  ('title_non_repairable', 'Non-Repairable (NR)', 'Не подлежит ремонту (NR)', 'salvage', 5),
  ('title_rebuilt', 'Rebuilt (RB)', 'Восстановленный (RB)', 'rebuilt', 6),
  ('title_junk', 'Junk (JK)', 'На запчасти (JK)', 'salvage', 7),
  ('title_parts_only', 'Parts Only (PR)', 'Только запчасти (PR)', 'salvage', 8),
  ('title_bond_title', 'Bond Title (BN)', 'Титул под залогом (BN)', 'special', 9),
  ('title_certificate_of_destruction', 'Certificate of Destruction (WT)', 'Свидетельство об уничтожении (WT)', 'salvage', 10),
  ('title_unknown', 'Unknown Title', 'Неизвестный титул', 'other', 999);

-- Seed statuses
INSERT INTO taxonomies.statuses (code, en, ru, category, sort_order) VALUES
  ('status_active', 'Active for Sale', 'Активный лот', 'active', 1),
  ('status_scheduled', 'Scheduled/Future Sale', 'Запланирован', 'future', 2),
  ('status_pending_result', 'Pending Result', 'Ожидание результата', 'pending', 3),
  ('status_sold', 'Sold', 'Продан', 'closed', 4),
  ('status_on_hold', 'On Hold', 'На удержании', 'paused', 5),
  ('status_cancelled', 'Cancelled', 'Отменён', 'closed', 6),
  ('status_unknown', 'Unknown Status', 'Неизвестный статус', 'other', 999);

-- Seed odometer brands
INSERT INTO taxonomies.odometer_brands (code, en, ru, category, sort_order) VALUES
  ('odometer_actual', 'Actual Mileage', 'Фактический пробег', 'reliable', 1),
  ('odometer_not_actual', 'Not Actual Mileage', 'Не фактический пробег', 'unreliable', 2),
  ('odometer_exempt', 'Exempt from Reporting', 'Освобождён от отчётности', 'exempt', 3),
  ('odometer_tmu', 'True Mileage Unknown (TMU)', 'Настоящий пробег неизвестен', 'unreliable', 4),
  ('odometer_replaced', 'Odometer Replaced', 'Одометр заменён', 'unreliable', 5),
  ('odometer_mechanical', 'Mechanical Odometer', 'Механический одометр', 'other', 6),
  ('odometer_unknown', 'Unknown', 'Неизвестно', 'other', 999);

-- (Continue for body_styles, fuel_types, transmission_types, drive_types, colors, runs_drives_status...)
-- Full seeding script in migration file

-- Create helper function for localized lookups
CREATE OR REPLACE FUNCTION get_taxonomy_label(
  domain TEXT,
  code TEXT,
  lang TEXT DEFAULT 'en'
) RETURNS TEXT AS $$
DECLARE
  label TEXT;
BEGIN
  EXECUTE format('SELECT %I FROM taxonomies.%I WHERE code = $1', lang, domain)
  INTO label
  USING code;

  RETURN COALESCE(label, code);
END;
$$ LANGUAGE plpgsql STABLE;

-- Create view for API consumption
CREATE OR REPLACE VIEW api.taxonomies_all AS
SELECT
  'damage_types' AS domain,
  code,
  jsonb_build_object('en', en, 'ru', ru) AS label,
  category,
  sort_order
FROM taxonomies.damage_types
WHERE NOT deprecated
UNION ALL
SELECT 'title_types', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.title_types WHERE NOT deprecated
UNION ALL
SELECT 'statuses', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.statuses WHERE NOT deprecated
UNION ALL
SELECT 'odometer_brands', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.odometer_brands WHERE NOT deprecated
UNION ALL
SELECT 'body_styles', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.body_styles WHERE NOT deprecated
UNION ALL
SELECT 'fuel_types', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.fuel_types WHERE NOT deprecated
UNION ALL
SELECT 'transmission_types', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.transmission_types WHERE NOT deprecated
UNION ALL
SELECT 'drive_types', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.drive_types WHERE NOT deprecated
UNION ALL
SELECT 'colors', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.colors WHERE NOT deprecated
UNION ALL
SELECT 'runs_drives_status', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.runs_drives_status WHERE NOT deprecated
ORDER BY domain, sort_order, code;
```

---

## API Integration

### Endpoint: `GET /api/v1/taxonomies`

**Response:**
```json
{
  "damage_types": [
    {
      "code": "damage_flood",
      "label": {"en": "Water/Flood Damage", "ru": "Повреждение водой/наводнением"},
      "category": "water",
      "sort_order": 1
    },
    ...
  ],
  "title_types": [...],
  "statuses": [...],
  ...
}
```

### Endpoint: `GET /api/v1/taxonomies/{domain}`

**Example:** `GET /api/v1/taxonomies/damage_types`

**Response:**
```json
{
  "domain": "damage_types",
  "items": [
    {
      "code": "damage_flood",
      "label": {"en": "Water/Flood Damage", "ru": "Повреждение водой/наводнением"},
      "category": "water",
      "sort_order": 1
    },
    ...
  ]
}
```

### Usage in Vehicle/Lot Responses

**Before (raw CSV value):**
```json
{
  "damage_primary": "WATER/FLOOD"
}
```

**After (with taxonomy):**
```json
{
  "damage_primary": {
    "code": "damage_flood",
    "label": {
      "en": "Water/Flood Damage",
      "ru": "Повреждение водой/наводнением"
    },
    "category": "water"
  }
}
```

---

## Translation Quality Assurance

### Process

1. **Initial Seed:** EN labels manually curated (from CSV analysis)
2. **Machine Translation:** RU labels generated via Google Translate API
3. **Native Review:** Russian native speaker reviews all translations
4. **Corrections:** Update RU labels where Google Translate failed
5. **Production Deploy:** Finalized taxonomy table seeded

### Translation Checklist

- [ ] All EN labels reviewed for consistency and clarity
- [ ] RU translations generated for 100% of codes
- [ ] Native speaker reviewed ≥90% of common taxonomies (damage, title, status, odometer)
- [ ] Automotive terminology validated (e.g., "CVT", "4WD", "TMU")
- [ ] Placeholder "TODO" removed from RU column

### Known Translation Challenges

**Automotive Jargon:**
- "Runs and Drives" → "Заводится и едет" (literal: "Starts and goes")
- "TMU" → "Настоящий пробег неизвестен" (expanded, not abbreviation)
- "Salvage Certificate" → "Свидетельство об утилизации" (legal term may vary by jurisdiction)

**Recommendations:**
- Consult with Russian automotive forum/market terminology
- Use terms from copart.ru (if available) for consistency
- Consider regional variations (RU vs KZ vs BY)

---

## Testing Strategy

### API Tests

**Location:** `tests/api/taxonomies.test.js`

**Test Cases:**
1. `GET /api/v1/taxonomies` → 200 with all domains
2. `GET /api/v1/taxonomies/damage_types` → 200 with ≥17 items
3. `GET /api/v1/taxonomies/invalid` → 404
4. Verify JSON structure: `{code, label: {en, ru}, category, sort_order}`
5. Verify sort order: items returned in `sort_order` ASC

### Database Tests

**Location:** `tests/db/taxonomies.test.sql`

**Test Cases:**
```sql
-- Test 1: All codes follow naming convention
SELECT code FROM taxonomies.damage_types WHERE code !~ '^damage_[a-z_]+$';
-- Expected: 0 rows

-- Test 2: No missing translations
SELECT code FROM taxonomies.damage_types WHERE en IS NULL OR ru IS NULL;
-- Expected: 0 rows

-- Test 3: Helper function works
SELECT get_taxonomy_label('damage_types', 'damage_flood', 'en');
-- Expected: 'Water/Flood Damage'

SELECT get_taxonomy_label('damage_types', 'damage_flood', 'ru');
-- Expected: 'Повреждение водой/наводнением'

-- Test 4: Invalid code returns code itself
SELECT get_taxonomy_label('damage_types', 'invalid_code', 'en');
-- Expected: 'invalid_code'
```

---

## Maintenance & Updates

### Adding New Taxonomies

**Process:**
1. Discover new CSV value in `audit.unknown_taxonomy_values`
2. Research meaning/context
3. Create canonical code (follow naming convention)
4. Add EN label
5. Generate RU translation
6. INSERT into appropriate taxonomy table
7. Test normalizer mapping
8. Deploy

**Example:**
```sql
-- New damage type discovered: "FLOOD - ENGINE"
INSERT INTO taxonomies.damage_types (code, en, ru, category, sort_order)
VALUES (
  'damage_flood_engine',
  'Flood Damage — Engine',
  'Повреждение двигателя наводнением',
  'water',
  18  -- Next available sort_order
);
```

### Deprecating Taxonomies

**Process:**
1. SET `deprecated = TRUE` (do not DELETE)
2. API excludes deprecated codes from listings
3. Historical data retains deprecated codes
4. Monitor usage: If deprecated code still referenced → investigate

**Example:**
```sql
UPDATE taxonomies.damage_types
SET deprecated = TRUE, updated_at = now()
WHERE code = 'damage_obsolete';
```

---

## Change Log

**2025-10-16 (v1.0 — Planning):**
- Defined 10 taxonomy domains with EN/RU translations
- Created database schema and helper functions
- Specified API integration patterns
- Documented translation QA process

---

**Next Steps:**
1. Apply migration `db/migrations/0011_taxonomies.sql`
2. Seed taxonomy tables with initial data
3. Implement API endpoints: `/api/v1/taxonomies` and `/api/v1/taxonomies/{domain}`
4. Update vehicle/lot DTOs to include taxonomy objects (not raw codes)
5. Add taxonomy tests to CI pipeline

---

**Status:** 📋 PLANNING COMPLETE — Ready for implementation
