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
    const wantYears = searchParams.get('years') === 'true'
    const vehicleType = (searchParams.get('type') || 'auto') as VehicleType

    // Create cache key from query parameters
    const cacheKey = `makes-models:${JSON.stringify({
      make,
      model,
      modelDetail,
      wantYears,
      vehicleType
    })}`

    // Use Redis cache with 10-minute TTL (filter options change infrequently)
    const result = await cacheGet(cacheKey, async () => {
      return await fetchMakesModelsFromDB(make, model, modelDetail, wantYears, vehicleType)
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
 */
async function fetchMakesModelsFromDB(
  make: string | undefined,
  model: string | undefined,
  modelDetail: string | undefined,
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
      const bodyFilter = bodyTypesIn ? `AND v.body IN (${bodyTypesIn})` : ''
      const filters: string[] = []
      const params: any[] = [make]
      let paramIndex = 2

      if (model) {
        filters.push(`AND v.model = $${paramIndex++}`)
        params.push(model)
      }
      if (modelDetail) {
        filters.push(`AND v.model_detail = $${paramIndex++}`)
        params.push(modelDetail)
      }

      const query = `
        SELECT DISTINCT v.year
        FROM vehicles v
        WHERE v.make = $1
          ${filters.join(' ')}
          AND v.year IS NOT NULL
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
      const bodyFilter = bodyTypesIn ? `AND v.body IN (${bodyTypesIn})` : ''
      const query = `
        SELECT v.model_detail, COUNT(*) as count
        FROM vehicles v
        WHERE v.make = $1
          AND v.model = $2
          AND v.model_detail IS NOT NULL
          AND v.model_detail <> ''
          ${bodyFilter}
        GROUP BY v.model_detail
        ORDER BY count DESC
        LIMIT 50
      `
      const result = await client.query(query, [make, model])

      return {
        make,
        model,
        modelDetails: result.rows.map(r => r.model_detail),
      }
    } else if (make) {
      // Return models for specific make and vehicle type
      const bodyFilter = bodyTypesIn ? `AND v.body IN (${bodyTypesIn})` : ''
      const query = `
        SELECT v.model, COUNT(*) as count
        FROM vehicles v
        WHERE v.make = $1
          AND v.model IS NOT NULL
          AND v.model <> ''
          AND v.model <> 'ALL MODELS'
          ${bodyFilter}
        GROUP BY v.model
        ORDER BY count DESC
        LIMIT 50
      `
      const result = await client.query(query, [make])

      return {
        make,
        models: result.rows.map(r => r.model),
      }
    } else {
      // Return top makes for vehicle type
      const bodyFilter = bodyTypesIn ? `AND body IN (${bodyTypesIn})` : ''
      const query = `
        SELECT make, COUNT(*) as count
        FROM vehicles
        WHERE make IS NOT NULL
          AND make <> ''
          ${bodyFilter}
        GROUP BY make
        ORDER BY count DESC
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
