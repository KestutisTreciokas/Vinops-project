/**
 * API v1 Response Types with Taxonomies
 * Sprint: S2 — SSR/SEO VIN & Catalog
 * Milestone: MS-S2-03 — API v1 Contract Restoration
 *
 * These types define the API response schema for the /api/v1/vehicles/{vin} endpoint
 * with bilingual taxonomy labels (EN/RU) for user-facing display.
 */

/**
 * Vehicle Details Response
 */
export interface VehicleDetailsResponse {
  /** Vehicle Identification Number (11-17 chars) */
  vin: string

  /** Vehicle year (e.g., 2015) */
  year: number | null

  /** Manufacturer (e.g., "TOYOTA") */
  make: string | null

  /** Model name (e.g., "CAMRY") */
  model: string | null

  /** Trim level (e.g., "SE", "LE") - currently null, future enhancement */
  trim: string | null

  /** Body style code (e.g., "SEDAN") */
  body: string | null

  /** Body style label in requested language (e.g., "Sedan" or "Седан") */
  bodyLabel: string | null

  /** Fuel type code (e.g., "GASOLINE") */
  fuel: string | null

  /** Fuel type label in requested language (e.g., "Gasoline" or "Бензин") */
  fuelLabel: string | null

  /** Transmission type code (e.g., "AUTOMATIC") */
  transmission: string | null

  /** Transmission type label in requested language (e.g., "Automatic" or "Автоматическая") */
  transmissionLabel: string | null

  /** Drive type code (e.g., "FWD", "AWD") */
  drive: string | null

  /** Drive type label in requested language (e.g., "Front-Wheel Drive (FWD)" or "Передний привод (FWD)") */
  driveLabel: string | null

  /** Engine description (e.g., "2.5L I4") */
  engine: string | null

  /** Current lot information (most recent auction listing) */
  currentLot: LotDetails | null

  /** Array of images for current lot */
  images: ImageDetails[]

  /** Array of past sale events (sold, not sold, etc.) */
  saleEvents: SaleEventDetails[]

  /** Last update timestamp (ISO 8601 UTC) */
  updatedAt: string

  /** Language used for taxonomy labels ("en" or "ru") */
  lang: 'en' | 'ru'
}

/**
 * Lot Details (Auction Listing)
 */
export interface LotDetails {
  /** Lot ID (unique per auction) */
  lotId: number

  /** Lot status code (e.g., "active", "upcoming", "sold") */
  status: string | null

  /** Lot status label in requested language (e.g., "Active for Sale" or "Активный лот") */
  statusLabel: string | null

  /** Auction site code (e.g., "CA-LOS_ANGELES") */
  siteCode: string | null

  /** City name (e.g., "Los Angeles") */
  city: string | null

  /** State/region code (e.g., "CA") */
  region: string | null

  /** Country code (e.g., "US") */
  country: string | null

  /** Auction date/time in UTC (ISO 8601) */
  auctionDateTimeUtc: string | null

  /** Estimated retail value in USD */
  estRetailValueUsd: number | null

  /** Whether vehicle runs and drives */
  runsDrives: boolean | null

  /** Whether keys are available */
  hasKeys: boolean | null

  /** Damage description code (e.g., "FRONT_END", "ALL_OVER") */
  damageDescription: string | null

  /** Damage description label in requested language (e.g., "Front End Damage" or "Повреждение передней части") */
  damageLabel: string | null

  /** Title type code (e.g., "SALVAGE", "CLEAR") */
  titleType: string | null

  /** Title type label in requested language (e.g., "Salvage (SV)" or "Утилизация (SV)") */
  titleLabel: string | null

  /** Odometer reading */
  odometer: number | null

  /** Odometer brand code (e.g., "ACTUAL", "TMU") */
  odometerBrand: string | null

  /** Odometer brand label in requested language (e.g., "Actual Mileage" or "Фактический пробег") */
  odometerBrandLabel: string | null

  /** Color code (e.g., "BLACK", "SILVER") */
  color: string | null

  /** Color label in requested language (e.g., "Black" or "Чёрный") */
  colorLabel: string | null

  /** Primary image URL (thumbnail or full size) */
  primaryImageUrl: string | null

  /** Total number of images available */
  imageCount: number

  /** Lot outcome (sold/not_sold/on_approval/unknown) - from CSV-only heuristic detection */
  outcome?: 'sold' | 'not_sold' | 'on_approval' | 'unknown'

  /** Outcome confidence score (0.00-1.00) */
  outcomeConfidence?: number

  /** When outcome was determined (ISO 8601) */
  outcomeDate?: string | null

  /** Number of times this VIN was relisted at auction */
  relistCount?: number

  /** Last known bid from CSV (pre-auction, may not reflect final sale price) */
  currentBidUsd?: number | null

  /** Final sale price (null for CSV-only, populated if third-party API added) */
  finalBidUsd?: number | null
}

/**
 * Image Details
 */
export interface ImageDetails {
  /** Lot ID this image belongs to */
  lot_id: number

  /** VIN this image belongs to */
  vin: string

  /** Sequence number (1-based, determines display order) */
  seq: number

  /** Image variant (e.g., "xl", "thumb") */
  variant: string

  /** Full CDN URL to image */
  url: string
}

/**
 * Sale Event Details
 */
export interface SaleEventDetails {
  /** Event type (e.g., "SOLD", "NOT_SOLD", "CANCELLED") */
  event_type: string

  /** Final price in USD (null if not sold) */
  price_usd: number | null

  /** Event timestamp in UTC (ISO 8601) */
  occurred_at_utc: string
}

/**
 * API Error Response
 */
export interface ApiErrorResponse {
  error: {
    /** Error code (e.g., "NOT_FOUND", "INVALID_VIN", "RATE_LIMITED") */
    code: string

    /** Human-readable error message */
    message: string
  }

  /** Request trace ID for debugging */
  traceId: string

  /** Optional status field (for SUPPRESSED errors) */
  status?: string
}

/**
 * HTTP Headers for Rate Limiting
 */
export interface RateLimitHeaders {
  /** Rate limit (requests per minute) */
  'X-RateLimit-Limit': string

  /** Remaining requests in current window */
  'X-RateLimit-Remaining': string

  /** Unix timestamp when rate limit resets */
  'X-RateLimit-Reset': string
}

/**
 * HTTP Status Codes
 */
export enum ApiStatusCode {
  /** Success - VIN found and returned */
  OK = 200,

  /** Not Modified - ETag match, use cached response */
  NOT_MODIFIED = 304,

  /** Not Found - VIN not in database */
  NOT_FOUND = 404,

  /** Gone - VIN suppressed/removed */
  GONE = 410,

  /** Unprocessable Entity - Invalid VIN format */
  UNPROCESSABLE_ENTITY = 422,

  /** Rate Limited - Too many requests */
  TOO_MANY_REQUESTS = 429,

  /** Internal Server Error - Database or server error */
  INTERNAL_SERVER_ERROR = 500,
}

/**
 * Search/Catalog API Types
 */

/**
 * Search Request Query Parameters
 */
export interface SearchQueryParams {
  /** Filter by make (e.g., "TOYOTA") */
  make?: string

  /** Filter by model (e.g., "CAMRY") */
  model?: string

  /** Filter by model detail/trim (e.g., "I3 BEV", "I8") */
  model_detail?: string

  /** Minimum year (e.g., 2015) */
  year_min?: number

  /** Maximum year (e.g., 2020) */
  year_max?: number

  /** Filter by lot status (e.g., "active", "upcoming") */
  status?: string

  /** Filter by auction site code (e.g., "CA-LOS_ANGELES") */
  site_code?: string

  /** Filter by country code (e.g., "US") */
  country?: string

  /** Results per page (default 20, max 100) */
  limit?: number

  /** Pagination cursor (base64-encoded) */
  cursor?: string

  /** Language for taxonomy labels ("en" or "ru", default "en") */
  lang?: 'en' | 'ru'

  /** Sort order (default "updated_at_desc") */
  sort?: 'auction_date_asc' | 'auction_date_desc' | 'year_desc' | 'year_asc' | 'created_at_desc' | 'created_at_asc' | 'updated_at_desc' | 'updated_at_asc'
}

/**
 * Search Response
 */
export interface SearchResponse {
  /** Array of vehicle listings */
  items: VehicleListingItem[]

  /** Pagination metadata */
  pagination: PaginationMetadata

  /** Applied filters for debugging */
  filters: AppliedFilters

  /** Language used for taxonomy labels */
  lang: 'en' | 'ru'
}

/**
 * Vehicle Listing Item (lighter than full VehicleDetailsResponse)
 */
export interface VehicleListingItem {
  /** Vehicle Identification Number */
  vin: string

  /** Vehicle year */
  year: number | null

  /** Manufacturer */
  make: string | null

  /** Model name */
  model: string | null

  /** Body style code */
  body: string | null

  /** Body style label */
  bodyLabel: string | null

  /** Lot ID */
  lotId: number | null

  /** Lot status code */
  status: string | null

  /** Lot status label */
  statusLabel: string | null

  /** Auction site code */
  siteCode: string | null

  /** City name */
  city: string | null

  /** State/region code */
  region: string | null

  /** Country code */
  country: string | null

  /** Auction date/time in UTC (ISO 8601) */
  auctionDateTimeUtc: string | null

  /** Estimated retail value in USD */
  estRetailValueUsd: number | null

  /** Damage description code */
  damageDescription: string | null

  /** Damage description label */
  damageLabel: string | null

  /** Title type code */
  titleType: string | null

  /** Title type label */
  titleLabel: string | null

  /** Odometer reading */
  odometer: number | null

  /** Primary image URL */
  primaryImageUrl: string | null

  /** Total image count */
  imageCount: number

  /** Last update timestamp */
  updatedAt: string

  /** Lot outcome (sold/not_sold/on_approval/unknown) - from CSV-only heuristic detection */
  outcome?: 'sold' | 'not_sold' | 'on_approval' | 'unknown'

  /** Outcome confidence score (0.00-1.00) */
  outcomeConfidence?: number

  /** When outcome was determined (ISO 8601) */
  outcomeDate?: string | null

  /** Number of times this VIN was relisted at auction */
  relistCount?: number

  /** Last known bid from CSV (pre-auction, may not reflect final sale price) */
  currentBidUsd?: number | null

  /** Final sale price (null for CSV-only, populated if third-party API added) */
  finalBidUsd?: number | null
}

/**
 * Pagination Metadata
 */
export interface PaginationMetadata {
  /** Next page cursor (base64-encoded), null if no more pages */
  nextCursor: string | null

  /** Whether there are more results */
  hasMore: boolean

  /** Number of items in current page */
  count: number

  /** Total count of matching results (optional, expensive to compute) */
  totalCount?: number
}

/**
 * Applied Filters (for debugging and UI display)
 */
export interface AppliedFilters {
  make?: string
  model?: string
  modelDetail?: string
  yearMin?: number
  yearMax?: number
  status?: string
  siteCode?: string
  country?: string
  limit: number
  sort: string
}
