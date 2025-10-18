import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '../../_lib/db'
import { getVehicleTypeFilter, type VehicleType } from '@/lib/vehicleTypes'
import { cacheGet } from '@/lib/redis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ====== CORS / Common Headers ======
const ALLOWED_ORIGINS = new Set(['https://vinops.online', 'https://www.vinops.online'])
const API_VERSION = '1'

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept-Language',
    'Vary': 'Origin, Accept-Language',
    'X-Api-Version': API_VERSION,
  }
  if (origin && ALLOWED_ORIGINS.has(origin)) h['Access-Control-Allow-Origin'] = origin
  return h
}

function json(body: any, init: { status: number; headers?: Record<string, string> }) {
  return NextResponse.json(body, { status: init.status, headers: init.headers ?? {} })
}

function parseIP(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  return (xff?.split(',')[0]?.trim()) || '0.0.0.0'
}

// ====== Rate Limiting (30 req/min for search, stricter than VIN endpoint) ======
type RLState = { count: number; resetAt: number; limit: number }
const rlStore: Map<string, RLState> = (global as any).__vinops_rl ?? new Map()
;(global as any).__vinops_rl = rlStore

function rateLimit(key: string, limit = 30) {
  const now = Date.now()
  const minute = 60_000
  const slot = Math.floor(now / minute)
  const k = `${key}:${slot}`
  const st = rlStore.get(k) ?? { count: 0, resetAt: (slot + 1) * minute, limit }
  st.count += 1
  st.limit = limit
  rlStore.set(k, st)
  const limited = st.count > limit
  const headers = {
    'X-RateLimit-Limit': String(st.limit),
    'X-RateLimit-Remaining': String(Math.max(0, st.limit - st.count)),
    'X-RateLimit-Reset': String(Math.floor(st.resetAt / 1000)),
  }
  return { limited, headers }
}

// ====== Cursor Encoding/Decoding ======
interface Cursor {
  /** Last VIN seen (for keyset pagination) */
  lastVin: string
  /** Last auction date (for sort stability) */
  lastAuctionDate: string | null
  /** Last year (for year sorting) */
  lastYear: number | null
  /** Last created_at timestamp (for newest lots sorting) */
  lastCreatedAt: string | null
  /** Last updated_at timestamp (for recently updated lots sorting) */
  lastUpdatedAt: string | null
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodeCursor(cursorStr: string): Cursor | null {
  try {
    const decoded = Buffer.from(cursorStr, 'base64url').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

// ====== Query Parameter Validation ======
function parseSearchParams(searchParams: URLSearchParams) {
  const make = searchParams.get('make')?.toUpperCase() || undefined
  const model = searchParams.get('model')?.toUpperCase() || undefined
  const modelDetail = searchParams.get('model_detail')?.toUpperCase() || undefined
  const yearMinStr = searchParams.get('year_min')
  const yearMaxStr = searchParams.get('year_max')
  const yearMin = yearMinStr ? parseInt(yearMinStr, 10) : undefined
  const yearMax = yearMaxStr ? parseInt(yearMaxStr, 10) : undefined
  const status = searchParams.get('status')?.toLowerCase() || undefined
  const siteCode = searchParams.get('site_code')?.toUpperCase() || undefined
  const country = searchParams.get('country')?.toUpperCase() || undefined
  const vehicleType = searchParams.get('vehicle_type') || searchParams.get('type') || undefined
  const limitStr = searchParams.get('limit')
  const limit = limitStr ? Math.min(Math.max(parseInt(limitStr, 10), 1), 100) : 20
  const cursor = searchParams.get('cursor') || undefined
  const sort = searchParams.get('sort') || 'updated_at_desc'
  const langParam = searchParams.get('lang') || 'en'
  const lang = (langParam === 'ru' || langParam === 'en') ? langParam : 'en'

  // Validate sort
  const validSorts = ['auction_date_asc', 'auction_date_desc', 'year_desc', 'year_asc', 'created_at_desc', 'created_at_asc', 'updated_at_desc', 'updated_at_asc']
  const finalSort = validSorts.includes(sort) ? sort : 'updated_at_desc'

  // Validate year range
  if (yearMin !== undefined && (isNaN(yearMin) || yearMin < 1900 || yearMin > 2100)) {
    return { error: 'Invalid year_min (must be 1900-2100)' }
  }
  if (yearMax !== undefined && (isNaN(yearMax) || yearMax < 1900 || yearMax > 2100)) {
    return { error: 'Invalid year_max (must be 1900-2100)' }
  }
  if (yearMin !== undefined && yearMax !== undefined && yearMin > yearMax) {
    return { error: 'year_min cannot be greater than year_max' }
  }

  return {
    make,
    model,
    modelDetail,
    yearMin,
    yearMax,
    status,
    siteCode,
    country,
    vehicleType,
    limit,
    cursor,
    sort: finalSort,
    lang,
  }
}

// ====== OPTIONS (CORS preflight) ======
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

// ====== GET /api/v1/search ======
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin')
  const ip = parseIP(req)
  const trace = crypto.randomUUID()

  // Rate limiting (30 req/min for search)
  const { limited, headers: rlHeaders } = rateLimit(`search:${ip}`, 30)
  if (limited) {
    return json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests' }, traceId: trace },
      { status: 429, headers: { ...corsHeaders(origin), ...rlHeaders } }
    )
  }

  // Parse and validate query parameters
  const params = parseSearchParams(req.nextUrl.searchParams)
  if ('error' in params) {
    return json(
      { error: { code: 'INVALID_PARAMS', message: params.error }, traceId: trace },
      { status: 400, headers: { ...corsHeaders(origin), ...rlHeaders } }
    )
  }

  const { make, model, modelDetail, yearMin, yearMax, status, siteCode, country, vehicleType, limit, cursor, sort, lang } = params

  // Decode cursor for pagination
  let cursorData: Cursor | null = null
  if (cursor) {
    cursorData = decodeCursor(cursor)
    if (!cursorData) {
      return json(
        { error: { code: 'INVALID_CURSOR', message: 'Invalid pagination cursor' }, traceId: trace },
        { status: 400, headers: { ...corsHeaders(origin), ...rlHeaders } }
      )
    }
  }

  // Create cache key from search parameters (exclude cursor for initial queries)
  const cacheKey = cursor ? null : `search:${JSON.stringify({
    vehicleType,
    make,
    model,
    modelDetail,
    yearMin,
    yearMax,
    status,
    siteCode,
    country,
    limit,
    sort,
    lang
  })}`

  // Build SQL query - use cache for initial queries (no cursor), skip cache for pagination
  try {
    const executeQuery = async () => {
      const pool = await getPool()
      const client = await pool.connect()
      try {
        // Build WHERE clause
        const conditions: string[] = []
        const values: any[] = []
        let paramIndex = 1

      // Add vehicle type filter
      // Include NULL bodies for 'auto' type (85% of vehicles have NULL body)
      if (vehicleType) {
        const bodyTypesIn = getVehicleTypeFilter(vehicleType as VehicleType)
        if (bodyTypesIn) {
          if (vehicleType === 'auto') {
            conditions.push(`(v.body IN (${bodyTypesIn}) OR v.body IS NULL)`)
          } else {
            conditions.push(`v.body IN (${bodyTypesIn})`)
          }
        }
      }

      if (make) {
        conditions.push(`v.make = $${paramIndex++}`)
        values.push(make)
      }
      if (model) {
        conditions.push(`v.model = $${paramIndex++}`)
        values.push(model)
      }
      if (modelDetail) {
        conditions.push(`COALESCE(NULLIF(v.trim, ''), v.model_detail) = $${paramIndex++}`)
        values.push(modelDetail)
      }
      if (yearMin !== undefined) {
        conditions.push(`v.year >= $${paramIndex++}`)
        values.push(yearMin)
      }
      if (yearMax !== undefined) {
        conditions.push(`v.year <= $${paramIndex++}`)
        values.push(yearMax)
      }
      if (status) {
        conditions.push(`l.status = $${paramIndex++}`)
        values.push(status)
      }
      if (siteCode) {
        conditions.push(`l.site_code = $${paramIndex++}`)
        values.push(siteCode)
      }
      if (country) {
        conditions.push(`l.country = $${paramIndex++}`)
        values.push(country)
      }

      // Add cursor condition for keyset pagination
      if (cursorData) {
        if (sort === 'auction_date_asc') {
          // Handle NULL auction dates: NULLs sort last in ASC with NULLS LAST
          if (cursorData.lastAuctionDate === null) {
            conditions.push(`(l.auction_datetime_utc IS NULL AND v.vin > $${paramIndex})`)
            values.push(cursorData.lastVin)
            paramIndex += 1
          } else {
            conditions.push(`(l.auction_datetime_utc > $${paramIndex} OR (l.auction_datetime_utc = $${paramIndex} AND v.vin > $${paramIndex + 1}) OR l.auction_datetime_utc IS NULL)`)
            values.push(cursorData.lastAuctionDate, cursorData.lastVin)
            paramIndex += 2
          }
        } else if (sort === 'auction_date_desc') {
          // Handle NULL auction dates: NULLs sort last in DESC with NULLS LAST
          if (cursorData.lastAuctionDate === null) {
            conditions.push(`(l.auction_datetime_utc IS NULL AND v.vin > $${paramIndex})`)
            values.push(cursorData.lastVin)
            paramIndex += 1
          } else {
            conditions.push(`(l.auction_datetime_utc < $${paramIndex} OR (l.auction_datetime_utc = $${paramIndex} AND v.vin > $${paramIndex + 1}))`)
            values.push(cursorData.lastAuctionDate, cursorData.lastVin)
            paramIndex += 2
          }
        } else if (sort === 'year_desc') {
          // Handle NULL years: NULLs sort last with NULLS LAST
          if (cursorData.lastYear === null) {
            conditions.push(`(v.year IS NULL AND v.vin > $${paramIndex})`)
            values.push(cursorData.lastVin)
            paramIndex += 1
          } else {
            conditions.push(`(v.year < $${paramIndex} OR (v.year = $${paramIndex} AND v.vin > $${paramIndex + 1}))`)
            values.push(cursorData.lastYear, cursorData.lastVin)
            paramIndex += 2
          }
        } else if (sort === 'year_asc') {
          // Handle NULL years: NULLs sort last with NULLS LAST
          if (cursorData.lastYear === null) {
            conditions.push(`(v.year IS NULL AND v.vin > $${paramIndex})`)
            values.push(cursorData.lastVin)
            paramIndex += 1
          } else {
            conditions.push(`(v.year > $${paramIndex} OR (v.year = $${paramIndex} AND v.vin > $${paramIndex + 1}) OR v.year IS NULL)`)
            values.push(cursorData.lastYear, cursorData.lastVin)
            paramIndex += 2
          }
        } else if (sort === 'created_at_desc') {
          // created_at should never be NULL (has DEFAULT now()), but handle it anyway
          if (cursorData.lastCreatedAt === null) {
            conditions.push(`v.vin > $${paramIndex}`)
            values.push(cursorData.lastVin)
            paramIndex += 1
          } else {
            conditions.push(`(l.created_at < $${paramIndex} OR (l.created_at = $${paramIndex} AND v.vin > $${paramIndex + 1}))`)
            values.push(cursorData.lastCreatedAt, cursorData.lastVin)
            paramIndex += 2
          }
        } else if (sort === 'created_at_asc') {
          if (cursorData.lastCreatedAt === null) {
            conditions.push(`v.vin > $${paramIndex}`)
            values.push(cursorData.lastVin)
            paramIndex += 1
          } else {
            conditions.push(`(l.created_at > $${paramIndex} OR (l.created_at = $${paramIndex} AND v.vin > $${paramIndex + 1}))`)
            values.push(cursorData.lastCreatedAt, cursorData.lastVin)
            paramIndex += 2
          }
        } else if (sort === 'updated_at_desc') {
          if (cursorData.lastUpdatedAt === null) {
            conditions.push(`v.vin > $${paramIndex}`)
            values.push(cursorData.lastVin)
            paramIndex += 1
          } else {
            conditions.push(`(l.updated_at < $${paramIndex} OR (l.updated_at = $${paramIndex} AND v.vin > $${paramIndex + 1}))`)
            values.push(cursorData.lastUpdatedAt, cursorData.lastVin)
            paramIndex += 2
          }
        } else if (sort === 'updated_at_asc') {
          if (cursorData.lastUpdatedAt === null) {
            conditions.push(`v.vin > $${paramIndex}`)
            values.push(cursorData.lastVin)
            paramIndex += 1
          } else {
            conditions.push(`(l.updated_at > $${paramIndex} OR (l.updated_at = $${paramIndex} AND v.vin > $${paramIndex + 1}))`)
            values.push(cursorData.lastUpdatedAt, cursorData.lastVin)
            paramIndex += 2
          }
        }
      }

      // Build ORDER BY clause
      let orderBy = ''
      switch (sort) {
        case 'auction_date_asc':
          orderBy = 'l.auction_datetime_utc ASC NULLS LAST, v.vin ASC'
          break
        case 'auction_date_desc':
          orderBy = 'l.auction_datetime_utc DESC NULLS LAST, v.vin ASC'
          break
        case 'year_desc':
          orderBy = 'v.year DESC NULLS LAST, v.vin ASC'
          break
        case 'year_asc':
          orderBy = 'v.year ASC NULLS LAST, v.vin ASC'
          break
        case 'created_at_desc':
          orderBy = 'l.created_at DESC NULLS LAST, v.vin ASC'
          break
        case 'created_at_asc':
          orderBy = 'l.created_at ASC NULLS LAST, v.vin ASC'
          break
        case 'updated_at_desc':
          orderBy = 'l.updated_at DESC NULLS LAST, v.vin ASC'
          break
        case 'updated_at_asc':
          orderBy = 'l.updated_at ASC NULLS LAST, v.vin ASC'
          break
        default:
          orderBy = 'l.updated_at DESC NULLS LAST, v.vin ASC'
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      values.push(lang)
      const langParamIndex = paramIndex++

      // Fetch limit + 1 to determine if there are more results
      values.push(limit + 1)
      const limitParamIndex = paramIndex++

      const query = `
        SELECT
          v.vin, v.make, v.model, v.year, v.body, v.updated_at,
          l.id as lot_id, l.status, l.site_code, l.city, l.region, l.country,
          l.auction_datetime_utc, l.created_at, l.updated_at as lot_updated_at, l.retail_value_usd, l.damage_description, l.title_type, l.odometer,
          l.buy_it_now_usd, l.current_bid_usd,
          l.outcome, l.outcome_confidence, l.outcome_date, l.relist_count, l.final_bid_usd,
          get_taxonomy_label('body_styles', v.body, $${langParamIndex}) as body_label,
          get_taxonomy_label('statuses', l.status, $${langParamIndex}) as status_label,
          get_taxonomy_label('damage_types', normalize_damage_code(l.damage_description), $${langParamIndex}) as damage_label,
          get_taxonomy_label('title_types', l.title_type, $${langParamIndex}) as title_label,
          (SELECT source_url FROM images WHERE vin = v.vin AND NOT is_removed ORDER BY seq ASC LIMIT 1) as primary_image_url,
          (SELECT COUNT(*) FROM images WHERE vin = v.vin AND NOT is_removed) as image_count
        FROM vehicles v
        LEFT JOIN lots l ON l.vin = v.vin
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${limitParamIndex}
      `

      const result = await client.query(query, values)

      // Determine if there are more results
      const hasMore = result.rows.length > limit
      const items = result.rows.slice(0, limit)

      // Generate next cursor
      let nextCursor: string | null = null
      if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1]
        nextCursor = encodeCursor({
          lastVin: lastItem.vin,
          lastAuctionDate: lastItem.auction_datetime_utc,
          lastYear: lastItem.year,
          lastCreatedAt: lastItem.created_at,
          lastUpdatedAt: lastItem.lot_updated_at,
        })
      }

        // Build response
        return {
          items: items.map((row) => ({
            vin: row.vin,
            year: row.year,
            make: row.make,
            model: row.model,
            body: row.body,
            bodyLabel: row.body_label,
            lotId: row.lot_id,
            status: row.status,
            statusLabel: row.status_label,
            siteCode: row.site_code,
            city: row.city,
            region: row.region,
            country: row.country,
            auctionDateTimeUtc: row.auction_datetime_utc,
            estRetailValueUsd: row.retail_value_usd,
            buyItNowUsd: row.buy_it_now_usd,
            currentBidUsd: row.current_bid_usd,
            damageDescription: row.damage_description,
            damageLabel: row.damage_label,
            titleType: row.title_type,
            titleLabel: row.title_label,
            odometer: row.odometer,
            primaryImageUrl: row.primary_image_url,
            imageCount: parseInt(row.image_count, 10),
            updatedAt: row.updated_at,
            outcome: row.outcome,
            outcomeConfidence: row.outcome_confidence,
            outcomeDate: row.outcome_date,
            relistCount: row.relist_count,
            finalBidUsd: row.final_bid_usd,
          })),
          pagination: {
            nextCursor,
            hasMore,
            count: items.length,
          },
          filters: {
            make,
            model,
            yearMin,
            yearMax,
            status,
            siteCode,
            country,
            limit,
            sort,
          },
          lang,
        }
      } finally {
        client.release()
      }
    }

    // Use Redis cache for initial queries (5-minute TTL), skip cache for pagination (cursor-based)
    const response = cacheKey
      ? await cacheGet(cacheKey, executeQuery, 300) // 300s = 5 minutes
      : await executeQuery()

    // Determine HTTP cache strategy
    const filterCount = [make, model, yearMin, yearMax, status, siteCode, country].filter(Boolean).length
    const cacheControl = filterCount <= 2
      ? 'public, max-age=60, stale-while-revalidate=300'  // Simple queries: cache 60s
      : 'public, max-age=30, stale-while-revalidate=120'  // Complex queries: cache 30s

    const headers = {
      ...corsHeaders(origin),
      ...rlHeaders,
      'Cache-Control': cacheControl,
    }

    return json(response, { status: 200, headers })
  } catch (err: any) {
    const rl = rateLimit(`search_err:${Date.now() >> 12}`, 120)
    return json(
      { error: { code: 'INTERNAL', message: err?.message || 'Internal error' }, traceId: trace },
      { status: 500, headers: { ...corsHeaders(origin), ...rl.headers, 'Cache-Control': 'no-store, must-revalidate' } }
    )
  }
}
