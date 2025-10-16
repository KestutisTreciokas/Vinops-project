#!/usr/bin/env node
/**
 * CSV Domain Normalizer — S1B ETL
 * Purpose: Normalize raw CSV values to canonical codes for database storage
 * Usage: const normalizer = require('./lib/csv-normalizer');
 */

const { Client } = require('pg');

// Database connection for logging unknowns
let dbClient = null;

/**
 * Initialize database client for unknown taxonomy logging
 */
function initDB(connectionString) {
  dbClient = new Client({ connectionString });
  return dbClient.connect();
}

/**
 * Log unknown taxonomy values to audit table
 */
async function logUnknownTaxonomy(domain, rawValue) {
  if (!dbClient || !rawValue) return;

  try {
    await dbClient.query(`
      INSERT INTO audit.unknown_taxonomy_values (domain, raw_value, occurrence_count, last_seen_at)
      VALUES ($1, $2, 1, now())
      ON CONFLICT (domain, raw_value)
      DO UPDATE SET
        occurrence_count = audit.unknown_taxonomy_values.occurrence_count + 1,
        last_seen_at = now()
    `, [domain, rawValue]);
  } catch (error) {
    console.error(`[WARN] Failed to log unknown taxonomy: ${domain}:${rawValue}`, error.message);
  }
}

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Normalize damage types
 * CSV: "WATER/FLOOD" → DB: "damage_flood"
 */
function normalizeDamage(raw) {
  if (!raw || raw.trim() === '') return null;

  const upper = raw.toUpperCase().trim();

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

  logUnknownTaxonomy('damage_types', raw);
  return 'damage_unknown_' + raw.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
}

/**
 * Normalize title types
 * CSV: "NR" → DB: "title_non_repairable"
 */
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

/**
 * Normalize sale status
 * CSV: "Pure Sale" → DB: "status_active"
 */
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

/**
 * Normalize odometer brand
 * CSV: "A" → DB: "odometer_actual"
 */
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

/**
 * Normalize body style
 * CSV: "SEDAN" → DB: "body_sedan"
 */
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

  // Fuzzy matching
  if (upper.includes('SEDAN')) return 'body_sedan';
  if (upper.includes('SUV') || upper.includes('SPORT UTILITY')) return 'body_suv';
  if (upper.includes('TRUCK') || upper.includes('PICKUP')) return 'body_pickup_truck';

  logUnknownTaxonomy('body_styles', raw);
  return null;
}

/**
 * Normalize fuel type
 * CSV: "GAS" → DB: "fuel_gasoline"
 */
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

/**
 * Normalize transmission type
 * CSV: "AUTOMATIC" → DB: "transmission_automatic"
 */
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

/**
 * Normalize drive type
 * CSV: "FWD" → DB: "drive_fwd"
 */
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

/**
 * Normalize color
 * CSV: "BLACK" → DB: "color_black"
 */
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

/**
 * Normalize runs/drives status
 * CSV: "YES" → DB: "runs_drives_yes"
 */
function normalizeRunsDrives(raw) {
  if (!raw || raw.trim() === '') return null;

  const upper = raw.toUpperCase().trim();

  if (upper === 'YES') return 'runs_drives_yes';
  if (upper === 'NO') return 'runs_drives_no';
  if (upper === 'UNKNOWN') return 'runs_drives_unknown';

  return 'runs_drives_unknown';
}

// ============================================================================
// TYPE CONVERSION FUNCTIONS
// ============================================================================

/**
 * Parse boolean fields
 * CSV: "YES" → DB: true
 */
function parseBoolean(raw) {
  if (!raw || raw.trim() === '') return null;

  const upper = raw.toUpperCase().trim();
  if (upper === 'YES' || upper === 'Y') return true;
  if (upper === 'NO' || upper === 'N') return false;

  return null;
}

/**
 * Parse odometer value
 * CSV: "123,456.7" → DB: 123456.7
 */
function parseOdometer(raw) {
  if (!raw || raw.trim() === '') return null;

  const cleaned = raw.replace(/[,\s]/g, '');
  const num = parseFloat(cleaned);

  return isNaN(num) ? null : num;
}

/**
 * Parse retail value
 * CSV: "$12,500.00" → DB: 12500.00
 */
function parseRetailValue(raw) {
  if (!raw || raw.trim() === '') return null;

  const cleaned = raw.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);

  return isNaN(num) || num < 0 ? null : num;
}

/**
 * Parse ISO 8601 timestamp
 * CSV: "2025-10-14T07:01:00Z" → DB: TIMESTAMPTZ
 */
function parseLastUpdated(raw) {
  if (!raw || raw.trim() === '') return null;

  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse non-standard create date/time
 * CSV: "2025-10-14-08.55.06.000795" → DB: TIMESTAMPTZ
 */
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

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate VIN
 * Rule: 11-17 characters, uppercase, exclude I/O/Q
 */
function validateVIN(vin) {
  if (!vin || vin.trim() === '') {
    return { valid: false, reason: 'empty' };
  }

  const normalized = vin.toUpperCase().trim();
  const regex = /^[A-HJ-NPR-Z0-9]{11,17}$/;

  if (!regex.test(normalized)) {
    return { valid: false, reason: 'invalid_format', vin: normalized };
  }

  return { valid: true, vin: normalized };
}

/**
 * Validate year
 * Rule: 1900-2100
 */
function validateYear(year) {
  const num = parseInt(year, 10);

  if (isNaN(num)) {
    return { valid: false, reason: 'not_a_number' };
  }

  if (num < 1900 || num > 2100) {
    return { valid: false, reason: 'out_of_range' };
  }

  return { valid: true, year: num };
}

/**
 * Validate lot external ID
 * Rule: NOT NULL, alphanumeric with hyphens
 */
function validateLotExternalID(lotID) {
  if (!lotID || lotID.trim() === '') {
    return { valid: false, reason: 'empty' };
  }

  const cleaned = lotID.trim();
  const regex = /^[A-Za-z0-9\-]+$/;

  if (!regex.test(cleaned)) {
    return { valid: false, reason: 'invalid_format' };
  }

  return { valid: true, lotID: cleaned };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Database init
  initDB,

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
