import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '../../_lib/db'
import { getVehicleTypeFilter, type VehicleType } from '@/lib/vehicleTypes'
import { cacheGet } from '@/lib/redis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/makes-models
 * Returns list of makes and their models for catalog filters
 * Query params:
 *  - make: optional, if provided returns models for that make
 *  - model: optional, if provided (with make) returns model_details for that model
 *  - model_detail: optional, if provided (with make, model, years=true) filters years by model_detail
 *  - year: optional, if provided filters subsequent selections (e.g., models for make+year, model_details for make+model+year)
 *  - years: if 'true', returns available years instead of model_details (requires make, optional model, optional model_detail)
 *  - type: vehicle type (auto, moto, etc.)
 *
 * WITH REDIS CACHING: 10-minute TTL for filter options (changes infrequently)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const make = searchParams.get('make')?.toUpperCase()
    const model = searchParams.get('model')?.toUpperCase()
    const modelDetail = searchParams.get('model_detail')?.toUpperCase()
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined
    const wantYears = searchParams.get('years') === 'true'
    const vehicleType = (searchParams.get('type') || 'auto') as VehicleType

    // Create cache key from query parameters
    const cacheKey = `makes-models:${JSON.stringify({
      make,
      model,
      modelDetail,
      year,
      wantYears,
      vehicleType
    })}`

    // Use Redis cache with 10-minute TTL (filter options change infrequently)
    const result = await cacheGet(cacheKey, async () => {
      return await fetchMakesModelsFromDB(make, model, modelDetail, year, wantYears, vehicleType)
    }, 600) // 600 seconds = 10 minutes

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=1800'
      }
    })
  } catch (error) {
    console.error('[API] makes-models error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Internal function that queries database for makes/models/years
 * Called by GET when cache misses
 * Now accepts year parameter to filter results by existing combinations
 */
async function fetchMakesModelsFromDB(
  make: string | undefined,
  model: string | undefined,
  modelDetail: string | undefined,
  year: number | undefined,
  wantYears: boolean,
  vehicleType: VehicleType
) {
  const pool = await getPool()
  const client = await pool.connect()

  try {
    // Get body type filter for vehicle type
    const bodyTypesIn = getVehicleTypeFilter(vehicleType)

    if (wantYears && make) {
      // Return available years for make (and optionally model and model_detail) and vehicle type
      // NOW FILTERS BY ACTIVE LOTS - only shows years with status='active' lots
      // Include NULL bodies for 'auto' type (85% of vehicles have NULL body)
      const bodyFilter = bodyTypesIn
        ? vehicleType === 'auto'
          ? `AND (v.body IN (${bodyTypesIn}) OR v.body IS NULL)`
          : `AND v.body IN (${bodyTypesIn})`
        : ''
      const filters: string[] = []
      const params: any[] = [make]
      let paramIndex = 2

      if (model) {
        filters.push(`AND v.model = $${paramIndex++}`)
        params.push(model)
      }
      if (modelDetail) {
        filters.push(`AND COALESCE(NULLIF(v.trim, ''), v.model_detail) = $${paramIndex++}`)
        params.push(modelDetail)
      }

      const query = `
        SELECT DISTINCT v.year
        FROM vehicles v
        INNER JOIN lots l ON l.vin = v.vin
        WHERE v.make = $1
          ${filters.join(' ')}
          AND v.year IS NOT NULL
          AND l.status = 'active'
          ${bodyFilter}
        ORDER BY v.year DESC
        LIMIT 100
      `
      const result = await client.query(query, params)

      return {
        make,
        model: model || null,
        modelDetail: modelDetail || null,
        years: result.rows.map(r => r.year),
      }
    } else if (make && model) {
      // Return model_details for specific make+model and vehicle type
      // NOW FILTERS BY ACTIVE LOTS - only shows model_details with status='active' lots
      // Uses COALESCE to prefer trim, fallback to model_detail when trim is empty
      // Include NULL bodies for 'auto' type (85% of vehicles have NULL body)
      // Filter by year if provided to show only available combinations
      const bodyFilter = bodyTypesIn
        ? vehicleType === 'auto'
          ? `AND (v.body IN (${bodyTypesIn}) OR v.body IS NULL)`
          : `AND v.body IN (${bodyTypesIn})`
        : ''
      const yearFilter = year ? `AND v.year = $3` : ''
      const params: any[] = [make, model]
      if (year) params.push(year)

      const query = `
        SELECT COALESCE(NULLIF(v.trim, ''), v.model_detail) as model_detail, COUNT(DISTINCT l.id) as count
        FROM vehicles v
        INNER JOIN lots l ON l.vin = v.vin
        WHERE v.make = $1
          AND v.model = $2
          AND COALESCE(NULLIF(v.trim, ''), v.model_detail) IS NOT NULL
          AND COALESCE(NULLIF(v.trim, ''), v.model_detail) <> ''
          AND l.status = 'active'
          ${bodyFilter}
          ${yearFilter}
        GROUP BY COALESCE(NULLIF(v.trim, ''), v.model_detail)
        ORDER BY model_detail ASC
        LIMIT 50
      `
      const result = await client.query(query, params)

      return {
        make,
        model,
        modelDetails: result.rows.map(r => r.model_detail),
      }
    } else if (make) {
      // Return models for specific make and vehicle type
      // NOW FILTERS BY ACTIVE LOTS - only shows models with status='active' lots
      // Include NULL bodies for 'auto' type (85% of vehicles have NULL body)
      // Filter by year if provided to show only available combinations
      const bodyFilter = bodyTypesIn
        ? vehicleType === 'auto'
          ? `AND (v.body IN (${bodyTypesIn}) OR v.body IS NULL)`
          : `AND v.body IN (${bodyTypesIn})`
        : ''
      const yearFilter = year ? `AND v.year = $2` : ''
      const params: any[] = [make]
      if (year) params.push(year)

      const query = `
        SELECT v.model, COUNT(DISTINCT l.id) as count
        FROM vehicles v
        INNER JOIN lots l ON l.vin = v.vin
        WHERE v.make = $1
          AND v.model IS NOT NULL
          AND v.model <> ''
          AND v.model <> 'ALL MODELS'
          AND l.status = 'active'
          ${bodyFilter}
          ${yearFilter}
        GROUP BY v.model
        ORDER BY v.model ASC
        LIMIT 50
      `
      const result = await client.query(query, params)

      return {
        make,
        models: result.rows.map(r => r.model),
      }
    } else {
      // Return top makes for vehicle type
      // NOW FILTERS BY ACTIVE LOTS - only shows makes with status='active' lots
      // Include NULL bodies for 'auto' type (85% of vehicles have NULL body)
      const bodyFilter = bodyTypesIn
        ? vehicleType === 'auto'
          ? `AND (v.body IN (${bodyTypesIn}) OR v.body IS NULL)`
          : `AND v.body IN (${bodyTypesIn})`
        : ''
      const query = `
        SELECT v.make, COUNT(DISTINCT l.id) as count
        FROM vehicles v
        INNER JOIN lots l ON l.vin = v.vin
        WHERE v.make IS NOT NULL
          AND v.make <> ''
          AND l.status = 'active'
          ${bodyFilter}
        GROUP BY v.make
        ORDER BY v.make ASC
        LIMIT 20
      `
      const result = await client.query(query)

      return {
        makes: result.rows.map(r => r.make),
      }
    }
  } finally {
    client.release()
  }
}
