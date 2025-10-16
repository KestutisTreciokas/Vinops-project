# API v1 Search Endpoint Documentation

**Sprint:** S2 — SSR/SEO VIN & Catalog
**Milestone:** MS-S2-03 — API v1 Contract Restoration
**Endpoint:** `GET /api/v1/search`
**Date:** 2025-10-16
**Status:** ✅ **Implemented**

---

## Overview

The `/api/v1/search` endpoint provides catalog functionality for browsing and filtering vehicle listings. It supports advanced filtering, cursor-based pagination, and bilingual taxonomy labels (EN/RU).

**Key Features:**
- ✅ Multi-field filtering (make, model, year range, status, location)
- ✅ Cursor-based pagination (efficient for large datasets)
- ✅ Multiple sort orders (auction date, year)
- ✅ Bilingual taxonomy labels (EN/RU)
- ✅ Rate limiting (30 requests per minute)
- ✅ Intelligent caching (60s for simple queries, 30s for complex)

---

## Endpoint Details

**Method:** `GET`
**Path:** `/api/v1/search`
**Rate Limit:** 30 requests per minute per IP
**CORS:** Allowed origins: `vinops.online`, `www.vinops.online`

---

## Request Parameters

All parameters are optional. If no filters are provided, returns all active vehicles.

| Parameter | Type | Description | Example | Default |
|-----------|------|-------------|---------|---------|
| `make` | string | Filter by manufacturer (uppercase) | `TOYOTA` | - |
| `model` | string | Filter by model (uppercase) | `CAMRY` | - |
| `year_min` | number | Minimum year (1900-2100) | `2015` | - |
| `year_max` | number | Maximum year (1900-2100) | `2020` | - |
| `status` | string | Lot status (lowercase) | `active` | - |
| `site_code` | string | Auction site code (uppercase) | `CA-LOS_ANGELES` | - |
| `country` | string | Country code (uppercase) | `US` | - |
| `limit` | number | Results per page (1-100) | `50` | `20` |
| `cursor` | string | Pagination cursor (base64-encoded) | `eyJsYXN0VmluIjoi...` | - |
| `lang` | string | Language for labels (`en` or `ru`) | `ru` | `en` |
| `sort` | string | Sort order (see below) | `year_desc` | `auction_date_asc` |

### Sort Options

| Value | Description |
|-------|-------------|
| `auction_date_asc` | Auction date ascending (soonest first) |
| `auction_date_desc` | Auction date descending (latest first) |
| `year_asc` | Year ascending (oldest first) |
| `year_desc` | Year descending (newest first) |

---

## Response Schema

### Success Response (200)

```typescript
{
  items: Array<{
    vin: string
    year: number | null
    make: string | null
    model: string | null
    body: string | null
    bodyLabel: string | null
    lotId: number | null
    status: string | null
    statusLabel: string | null
    siteCode: string | null
    city: string | null
    region: string | null
    country: string | null
    auctionDateTimeUtc: string | null
    estRetailValueUsd: number | null
    damageDescription: string | null
    damageLabel: string | null
    titleType: string | null
    titleLabel: string | null
    odometer: number | null
    primaryImageUrl: string | null
    imageCount: number
    updatedAt: string
  }>
  pagination: {
    nextCursor: string | null
    hasMore: boolean
    count: number
  }
  filters: {
    make?: string
    model?: string
    yearMin?: number
    yearMax?: number
    status?: string
    siteCode?: string
    country?: string
    limit: number
    sort: string
  }
  lang: 'en' | 'ru'
}
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_PARAMS` | Invalid query parameters (e.g., invalid year range) |
| 400 | `INVALID_CURSOR` | Malformed pagination cursor |
| 429 | `RATE_LIMITED` | Rate limit exceeded (30 req/min) |
| 500 | `INTERNAL` | Database or server error |

---

## Examples

### Example 1: Basic Search (All Active Vehicles)

**Request:**
```bash
GET /api/v1/search?limit=5
```

**Response:**
```json
{
  "items": [
    {
      "vin": "1HGBH41JXMN109186",
      "year": 2015,
      "make": "TOYOTA",
      "model": "CAMRY",
      "body": "SEDAN",
      "bodyLabel": "Sedan",
      "lotId": 12345678,
      "status": "active",
      "statusLabel": "Active for Sale",
      "siteCode": "CA-LOS_ANGELES",
      "city": "Los Angeles",
      "region": "CA",
      "country": "US",
      "auctionDateTimeUtc": "2025-10-20T14:00:00.000Z",
      "estRetailValueUsd": 8500,
      "damageDescription": "FRONT END",
      "damageLabel": "Front End Damage",
      "titleType": "SALVAGE",
      "titleLabel": "Salvage (SV)",
      "odometer": 85000,
      "primaryImageUrl": "https://img.vinops.online/copart/1HGBH41JXMN109186/12345678/xl/1.webp",
      "imageCount": 15,
      "updatedAt": "2025-10-16T10:00:00.000Z"
    }
    // ... 4 more items
  ],
  "pagination": {
    "nextCursor": "eyJsYXN0VmluIjoiMUhHQkg0MUpYTU4xMDkxODYiLCJsYXN0QXVjdGlvbkRhdGUiOiIyMDI1LTEwLTIwVDE0OjAwOjAwLjAwMFoiLCJsYXN0WWVhciI6MjAxNX0=",
    "hasMore": true,
    "count": 5
  },
  "filters": {
    "limit": 5,
    "sort": "auction_date_asc"
  },
  "lang": "en"
}
```

---

### Example 2: Filter by Make and Model

**Request:**
```bash
GET /api/v1/search?make=TOYOTA&model=CAMRY&limit=20
```

**Response:**
```json
{
  "items": [
    // ... 20 Toyota Camry listings
  ],
  "pagination": {
    "nextCursor": "eyJsYXN0VmluIjoi...",
    "hasMore": true,
    "count": 20
  },
  "filters": {
    "make": "TOYOTA",
    "model": "CAMRY",
    "limit": 20,
    "sort": "auction_date_asc"
  },
  "lang": "en"
}
```

---

### Example 3: Year Range Filter

**Request:**
```bash
GET /api/v1/search?year_min=2018&year_max=2022&sort=year_desc&limit=10
```

**Response:**
```json
{
  "items": [
    // ... vehicles from 2018-2022, newest first
  ],
  "pagination": {
    "nextCursor": "eyJsYXN0VmluIjoi...",
    "hasMore": true,
    "count": 10
  },
  "filters": {
    "yearMin": 2018,
    "yearMax": 2022,
    "limit": 10,
    "sort": "year_desc"
  },
  "lang": "en"
}
```

---

### Example 4: Pagination (Next Page)

**Request:**
```bash
GET /api/v1/search?limit=20&cursor=eyJsYXN0VmluIjoiMUhHQkg0MUpYTU4xMDkxODYiLCJsYXN0QXVjdGlvbkRhdGUiOiIyMDI1LTEwLTIwVDE0OjAwOjAwLjAwMFoiLCJsYXN0WWVhciI6MjAxNX0=
```

**Response:**
```json
{
  "items": [
    // ... next 20 items after cursor
  ],
  "pagination": {
    "nextCursor": "eyJsYXN0VmluIjoi...",
    "hasMore": true,
    "count": 20
  },
  "filters": {
    "limit": 20,
    "sort": "auction_date_asc"
  },
  "lang": "en"
}
```

---

### Example 5: Russian Labels

**Request:**
```bash
GET /api/v1/search?make=TOYOTA&limit=5&lang=ru
```

**Response:**
```json
{
  "items": [
    {
      "vin": "1HGBH41JXMN109186",
      "year": 2015,
      "make": "TOYOTA",
      "model": "CAMRY",
      "body": "SEDAN",
      "bodyLabel": "Седан",
      "lotId": 12345678,
      "status": "active",
      "statusLabel": "Активный лот",
      "damageDescription": "FRONT END",
      "damageLabel": "Повреждение передней части",
      "titleType": "SALVAGE",
      "titleLabel": "Утилизация (SV)",
      // ... other fields
    }
  ],
  "lang": "ru"
}
```

---

### Example 6: Location Filter

**Request:**
```bash
GET /api/v1/search?country=US&site_code=CA-LOS_ANGELES&limit=10
```

**Response:**
```json
{
  "items": [
    // ... vehicles at Los Angeles, CA auction site
  ],
  "pagination": {
    "nextCursor": "eyJsYXN0VmluIjoi...",
    "hasMore": true,
    "count": 10
  },
  "filters": {
    "country": "US",
    "siteCode": "CA-LOS_ANGELES",
    "limit": 10,
    "sort": "auction_date_asc"
  },
  "lang": "en"
}
```

---

### Example 7: Complex Query (Multiple Filters)

**Request:**
```bash
GET /api/v1/search?make=TOYOTA&year_min=2015&year_max=2020&status=active&country=US&sort=year_desc&limit=25
```

**Response:**
```json
{
  "items": [
    // ... Toyota vehicles from 2015-2020, active status, US only, newest first
  ],
  "pagination": {
    "nextCursor": "eyJsYXN0VmluIjoi...",
    "hasMore": false,
    "count": 18
  },
  "filters": {
    "make": "TOYOTA",
    "yearMin": 2015,
    "yearMax": 2020,
    "status": "active",
    "country": "US",
    "limit": 25,
    "sort": "year_desc"
  },
  "lang": "en"
}
```

---

## Rate Limiting

**Limit:** 30 requests per minute per IP address

**Headers:**
```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 1729123456
```

**Error Response (429):**
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests"
  },
  "traceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Caching Strategy

The endpoint uses intelligent caching based on query complexity:

| Query Type | Cache-Control | Description |
|------------|---------------|-------------|
| Simple (≤2 filters) | `public, max-age=60, stale-while-revalidate=300` | 60s cache, 5min stale |
| Complex (>2 filters) | `public, max-age=30, stale-while-revalidate=120` | 30s cache, 2min stale |

**Simple queries:** No filters, or 1-2 filters (e.g., `?make=TOYOTA`)
**Complex queries:** 3+ filters (e.g., `?make=TOYOTA&model=CAMRY&year_min=2015&status=active`)

---

## Cursor-Based Pagination

The endpoint uses **keyset pagination** for efficient traversal of large datasets.

### How It Works

1. First request returns `pagination.nextCursor` (base64-encoded)
2. Next request includes `cursor` parameter with previous `nextCursor` value
3. Cursor contains: `{ lastVin, lastAuctionDate, lastYear }`
4. Query uses cursor values for efficient "WHERE ... > cursor" filtering

### Benefits

- ✅ Efficient for large datasets (no OFFSET)
- ✅ Consistent results (no skipped/duplicate items)
- ✅ Stable pagination (new items don't affect pagination)

### Cursor Format

```typescript
interface Cursor {
  lastVin: string               // Last VIN seen
  lastAuctionDate: string | null  // Last auction date (for date sorting)
  lastYear: number | null         // Last year (for year sorting)
}
```

**Encoded Example:**
```
eyJsYXN0VmluIjoiMUhHQkg0MUpYTU4xMDkxODYiLCJsYXN0QXVjdGlvbkRhdGUiOiIyMDI1LTEwLTIwVDE0OjAwOjAwLjAwMFoiLCJsYXN0WWVhciI6MjAxNX0=
```

**Decoded:**
```json
{
  "lastVin": "1HGBH41JXMN109186",
  "lastAuctionDate": "2025-10-20T14:00:00.000Z",
  "lastYear": 2015
}
```

---

## Performance Considerations

### Database Query Optimization

**Recommended Indexes:**
```sql
CREATE INDEX idx_vehicles_make_model ON vehicles(make, model);
CREATE INDEX idx_vehicles_year ON vehicles(year);
CREATE INDEX idx_lots_status ON lots(status);
CREATE INDEX idx_lots_auction_datetime ON lots(auction_datetime_utc);
CREATE INDEX idx_lots_site_code ON lots(site_code);
CREATE INDEX idx_lots_country ON lots(country);
```

### Query Complexity

| Filters | Complexity | Expected Performance |
|---------|------------|----------------------|
| 0-1 | Low | <100ms |
| 2-3 | Medium | 100-300ms |
| 4+ | High | 300-1000ms |

### Optimization Tips

1. **Use specific filters** — More filters = faster queries (narrower result set)
2. **Avoid year ranges** — Year filters can be slow without indexes
3. **Paginate with cursor** — Always use `cursor` for subsequent pages
4. **Cache responses** — Respect `Cache-Control` headers

---

## Error Handling

### Invalid Parameters (400)

**Example:**
```bash
GET /api/v1/search?year_min=2025&year_max=2020
```

**Response:**
```json
{
  "error": {
    "code": "INVALID_PARAMS",
    "message": "year_min cannot be greater than year_max"
  },
  "traceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Invalid Cursor (400)

**Example:**
```bash
GET /api/v1/search?cursor=invalid-base64
```

**Response:**
```json
{
  "error": {
    "code": "INVALID_CURSOR",
    "message": "Invalid pagination cursor"
  },
  "traceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## TypeScript Usage

```typescript
import { SearchResponse, SearchQueryParams } from '@/contracts/types/api-v1'

async function searchVehicles(params: SearchQueryParams): Promise<SearchResponse> {
  const query = new URLSearchParams(params as any).toString()
  const response = await fetch(`/api/v1/search?${query}`)

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  return response.json()
}

// Usage
const results = await searchVehicles({
  make: 'TOYOTA',
  model: 'CAMRY',
  year_min: 2015,
  limit: 20,
  lang: 'en',
})

console.log(results.items.length)  // 20
console.log(results.pagination.hasMore)  // true
console.log(results.pagination.nextCursor)  // "eyJsYXN0VmluIjoi..."
```

---

## Security

### CORS Policy

**Allowed Origins:**
- `https://vinops.online`
- `https://www.vinops.online`

**Allowed Methods:** `GET`, `OPTIONS`

**Allowed Headers:** `Content-Type`, `Accept-Language`

### Rate Limiting

- 30 requests per minute per IP
- Sliding window (1-minute slots)
- In-memory storage (resets on server restart)
- For production: consider Redis-based rate limiting

### Input Validation

- All parameters validated and sanitized
- SQL injection protection via parameterized queries
- Year range validation (1900-2100)
- Limit capped at 100

---

## Testing

### Test 1: Basic Query

```bash
curl -X GET "http://localhost:3000/api/v1/search?limit=5"
```

### Test 2: Filter by Make

```bash
curl -X GET "http://localhost:3000/api/v1/search?make=TOYOTA&limit=10"
```

### Test 3: Year Range

```bash
curl -X GET "http://localhost:3000/api/v1/search?year_min=2015&year_max=2020&limit=10"
```

### Test 4: Pagination

```bash
# First page
curl -X GET "http://localhost:3000/api/v1/search?limit=5"

# Extract nextCursor from response, then:
curl -X GET "http://localhost:3000/api/v1/search?limit=5&cursor=eyJsYXN0VmluIjoi..."
```

### Test 5: Russian Labels

```bash
curl -X GET "http://localhost:3000/api/v1/search?make=TOYOTA&limit=5&lang=ru"
```

---

## References

- **Implementation:** `frontend/src/app/api/v1/search/route.ts`
- **TypeScript Types:** `contracts/types/api-v1.ts`
- **VIN Endpoint:** `docs/API_v1_AUDIT.md`
- **Database Schema:** `docs/DB_PASSPORT.md`
- **Taxonomies:** `db/migrations/0011_taxonomies.sql`
