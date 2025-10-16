import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '../../../_lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // без фреймворк-кэша

// ====== CORS / общие заголовки ======
const ALLOWED_ORIGINS = new Set(['https://vinops.online', 'https://www.vinops.online'])
const API_VERSION = '1'

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, If-None-Match, If-Modified-Since, Accept-Language',
    'Vary': 'Origin, Accept-Language',
    'X-Api-Version': API_VERSION,
  }
  if (origin && ALLOWED_ORIGINS.has(origin)) h['Access-Control-Allow-Origin'] = origin
  return h
}

function json(body: any, init: { status: number; headers?: Record<string, string> }) {
  return NextResponse.json(body, { status: init.status, headers: init.headers ?? {} })
}

function weakETagFor(obj: any) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex')
  return `W/"${hash}"`
}

function parseIP(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  return (xff?.split(',')[0]?.trim()) || '0.0.0.0'
}

// ====== Простейший RL по IP+ключу (1-минутные окна) ======
type RLState = { count: number; resetAt: number; limit: number }
const rlStore: Map<string, RLState> = (global as any).__vinops_rl ?? new Map()
;(global as any).__vinops_rl = rlStore

function rateLimit(key: string, limit = 60) {
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

// ====== Инварианты VIN ======
const VIN_RE = /^[A-HJ-NPR-Z0-9]{11,17}$/

// ====== SMOKE-флаги ======
const SMOKE_ENABLED = (process.env.API_SMOKE_STUB_ENABLE ?? '0') === '1'
const SMOKE_WHITELIST = process.env.API_SMOKE_WHITELIST_VIN ?? ''
const SMOKE_SUPPRESS  = process.env.API_SMOKE_SUPPRESS_VIN  ?? ''

// Для whitelist делаем стабильно одинаковый updatedAt, чтобы ETag не прыгал
const SMOKE_FIXED_UPDATED_AT = '2024-01-01T00:00:00.000Z'

// ====== OPTIONS (CORS preflight) ======
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

// ====== GET /api/v1/vehicles/{vin} ======
export async function GET(req: NextRequest, ctx: { params: { vin: string } }) {
  const origin = req.headers.get('origin')
  const ip = parseIP(req)
  const trace = crypto.randomUUID()
  const { limited, headers: rlHeaders } = rateLimit(`veh:${ip}`, 60)
  if (limited) {
    return json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' }, traceId: trace }, {
      status: 429,
      headers: { ...corsHeaders(origin), ...rlHeaders }
    })
  }

  const raw = (ctx.params.vin || '').toUpperCase()
  if (!VIN_RE.test(raw)) {
    return json({ error: { code: 'INVALID_VIN', message: 'VIN must be 11–17 uppercase, excluding I/O/Q' }, traceId: trace }, {
      status: 422,
      headers: { ...corsHeaders(origin), ...rlHeaders, 'Cache-Control': 'no-store, must-revalidate' }
    })
  }

  // 410 suppress (SMOKE)
  if (SMOKE_ENABLED && raw === SMOKE_SUPPRESS) {
    return json({ error: { code: 'SUPPRESSED', message: 'VIN removed/suppressed' }, status: 'suppressed', traceId: trace }, {
      status: 410,
      headers: { ...corsHeaders(origin), ...rlHeaders, 'Cache-Control': 'no-store, must-revalidate' }
    })
  }

  // 200 stub (SMOKE whitelist) — стабильный ETag/Last-Modified
  if (SMOKE_ENABLED && raw === SMOKE_WHITELIST) {
    const lang = (req.headers.get('accept-language') || 'en').split(',')[0]?.trim() || 'en'
    const dto = {
      vin: raw, year: 2003, make: 'Honda', model: 'Accord', trim: 'EX',
      body: 'Sedan', fuel: 'Gasoline', transmission: 'Automatic', drive: 'FWD', engine: '2.4L',
      currentLot: {
        lotId: 12345678, status: 'ON_AUCTION', siteCode: 'CA-SACRAMENTO',
        city: 'Sacramento', region: 'CA', country: 'US',
        auctionDateTimeUtc: SMOKE_FIXED_UPDATED_AT,
        estRetailValueUsd: 3500, runsDrives: true, hasKeys: true,
        primaryImageUrl: `https://img.vinops.online/copart/${raw}/12345678/xl/1.webp`,
        imageCount: 10,
      },
      images: [
        { lotId: 12345678, vin: raw, seq: 1, variant: 'xl', url: `https://img.vinops.online/copart/${raw}/12345678/xl/1.webp` }
      ],
      saleEvents: [],
      updatedAt: SMOKE_FIXED_UPDATED_AT,
      lang,
    }
    const etag = weakETagFor(dto)
    const ifNoneMatch = req.headers.get('if-none-match')
    const headers = {
      ...corsHeaders(origin),
      ...rlHeaders,
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'ETag': etag,
      'Last-Modified': new Date(SMOKE_FIXED_UPDATED_AT).toUTCString(),
    }
    if (ifNoneMatch && ifNoneMatch === etag) {
      // 304 Not Modified
      return new NextResponse(null, { status: 304, headers })
    }
    return json(dto, { status: 200, headers })
  }

  // ====== Реальный путь: читаем из БД (read-only). В SMOKE при ошибке коннекта → 404 no-store ======
  try {
    const pool = await getPool()
    const client = await pool.connect()
    try {
      // Accept-Language header for taxonomy labels
      const acceptLang = req.headers.get('accept-language') || 'en'
      const lang = acceptLang.split(',')[0]?.trim()?.split('-')[0]?.toLowerCase() || 'en'
      const finalLang = (lang === 'ru' || lang === 'en') ? lang : 'en'

      // Query with taxonomies integration
      const q = `
        with vv as (
          select vin, make, model, year, body, fuel, transmission, drive, engine, updated_at
          from vehicles where vin = $1
        ),
        ll as (
          select id as lot_id, status, site_code, city, region, country, auction_datetime_utc, retail_value_usd,
                 vin, damage_description, title_type, odometer, odometer_brand
          from lots where vin = $1
          order by auction_datetime_utc desc nulls last
          limit 1
        )
        select
          vv.vin, vv.make, vv.model, vv.year, vv.body, vv.fuel, vv.transmission, vv.drive, vv.engine, vv.updated_at,
          ll.lot_id, ll.status, ll.site_code, ll.city, ll.region, ll.country, ll.auction_datetime_utc, ll.retail_value_usd,
          ll.damage_description, ll.title_type, ll.odometer, ll.odometer_brand,
          get_taxonomy_label('statuses', ll.status, $2) as status_label,
          get_taxonomy_label('damage_types', ll.damage_description, $2) as damage_label,
          get_taxonomy_label('title_types', ll.title_type, $2) as title_label,
          get_taxonomy_label('odometer_brands', ll.odometer_brand, $2) as odometer_brand_label,
          get_taxonomy_label('body_styles', vv.body, $2) as body_label,
          get_taxonomy_label('fuel_types', vv.fuel, $2) as fuel_label,
          get_taxonomy_label('transmission_types', vv.transmission, $2) as transmission_label,
          get_taxonomy_label('drive_types', vv.drive, $2) as drive_label
        from vv left join ll on ll.vin = vv.vin
      `
      const r = await client.query(q, [raw, finalLang])
      if (!r.rowCount) {
        return json({ error: { code: 'NOT_FOUND', message: 'VIN not found' }, traceId: trace }, {
          status: 404,
          headers: { ...corsHeaders(origin), ...rlHeaders, 'Cache-Control': 'no-store, must-revalidate' }
        })
      }
      const row = r.rows[0]
      // images
      const imgs = await client.query('select lot_id, vin, seq, variant, source_url as url from images where vin=$1 order by seq asc limit 16', [raw])
      // saleEvents
      const se = await client.query('select event_type, price_usd, occurred_at_utc from sale_events where vin=$1 order by occurred_at_utc desc limit 10', [raw])

      const dto: any = {
        vin: row.vin, year: row.year, make: row.make, model: row.model, trim: null,
        body: row.body, bodyLabel: row.body_label,
        fuel: row.fuel, fuelLabel: row.fuel_label,
        transmission: row.transmission, transmissionLabel: row.transmission_label,
        drive: row.drive, driveLabel: row.drive_label,
        engine: row.engine,
        currentLot: row.lot_id ? {
          lotId: row.lot_id,
          status: row.status, statusLabel: row.status_label,
          siteCode: row.site_code, city: row.city, region: row.region, country: row.country,
          auctionDateTimeUtc: row.auction_datetime_utc, estRetailValueUsd: row.retail_value_usd,
          damageDescription: row.damage_description, damageLabel: row.damage_label,
          titleType: row.title_type, titleLabel: row.title_label,
          odometer: row.odometer, odometerBrand: row.odometer_brand, odometerBrandLabel: row.odometer_brand_label,
          primaryImageUrl: imgs.rows[0]?.url ?? null,
          imageCount: imgs.rowCount,
        } : null,
        images: imgs.rows,
        saleEvents: se.rows,
        updatedAt: row.updated_at,
        lang: finalLang,
      }

      const etag = weakETagFor(dto)
      const ifNoneMatch = req.headers.get('if-none-match')
      const headers = {
        ...corsHeaders(origin),
        ...rlHeaders,
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'ETag': etag,
        ...(dto.updatedAt ? { 'Last-Modified': new Date(dto.updatedAt).toUTCString() } : {})
      }
      if (ifNoneMatch && ifNoneMatch === etag) {
        return new NextResponse(null, { status: 304, headers })
      }
      return json(dto, { status: 200, headers })
    } finally {
      client.release()
    }
  } catch (err: any) {
    const rl = rateLimit(`veh_err:${Date.now() >> 12}`, 120) // мягкий RL ошибок
    const origin = req.headers.get('origin')
    // В SMOKE режиме при недоступной БД возвращаем 404 (no-store) для валидных VIN
    if (SMOKE_ENABLED && (err?.code === 'ECONNREFUSED' || /ECONNREFUSED|ENOTFOUND|timeout/i.test(String(err?.message)))) {
      return json({ error: { code: 'NOT_FOUND', message: 'VIN not found (SMOKE-FALLBACK)' }, traceId: crypto.randomUUID() }, {
        status: 404,
        headers: { ...corsHeaders(origin), ...rl.headers, 'Cache-Control': 'no-store, must-revalidate' }
      })
    }
    return json({ error: { code: 'INTERNAL', message: err?.message || 'Internal error' }, traceId: crypto.randomUUID() }, {
      status: 500,
      headers: { ...corsHeaders(origin), ...rl.headers, 'Cache-Control': 'no-store, must-revalidate' }
    })
  }
}
