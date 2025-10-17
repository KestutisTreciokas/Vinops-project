import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '../../_lib/db'
import { getVehicleTypeFilter, type VehicleType } from '@/lib/vehicleTypes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/makes-models
 * Returns list of makes and their models for catalog filters
 * Query params:
 *  - make: optional, if provided returns models for that make
 *  - model: optional, if provided (with make) returns model_details for that model
 *  - type: vehicle type (auto, moto, etc.)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const make = searchParams.get('make')?.toUpperCase()
    const model = searchParams.get('model')?.toUpperCase()
    const vehicleType = (searchParams.get('type') || 'auto') as VehicleType

    // Get body type filter for vehicle type
    const bodyTypesIn = getVehicleTypeFilter(vehicleType)

    const pool = await getPool()
    const client = await pool.connect()

    try {
      if (make && model) {
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

        return NextResponse.json({
          make,
          model,
          modelDetails: result.rows.map(r => r.model_detail),
        }, {
          headers: {
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
          }
        })
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

        return NextResponse.json({
          make,
          models: result.rows.map(r => r.model),
        }, {
          headers: {
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
          }
        })
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

        return NextResponse.json({
          makes: result.rows.map(r => r.make),
        }, {
          headers: {
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
          }
        })
      }
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[API] makes-models error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
