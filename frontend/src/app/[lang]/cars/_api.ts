/**
 * Server-side API fetching for catalog page
 * Sprint: S2 — Catalog Integration
 */

import type { SearchResponse, SearchQueryParams } from '@/contracts/types/api-v1'
import { getPool } from '../../api/_lib/db'
import { getVehicleTypeFilter, type VehicleType } from '@/lib/vehicleTypes'

/**
 * Fetch vehicles directly from database (server-side only)
 * Bypasses HTTP to avoid SSR self-connection issues
 */
export async function fetchVehicles(
  params: SearchQueryParams & { vehicleType?: VehicleType }
): Promise<SearchResponse | null> {
  try {
    const pool = await getPool()
    const client = await pool.connect()

    try {
      const lang = params.lang || 'en'
      const limit = Math.min(params.limit || 20, 100)
      const sort = params.sort || 'updated_at_desc'

      // Build WHERE clause
      const conditions: string[] = []
      const values: any[] = []
      let paramIndex = 1

      // Add vehicle type filter
      if (params.vehicleType) {
        const bodyTypesIn = getVehicleTypeFilter(params.vehicleType)
        if (bodyTypesIn) {
          conditions.push(`v.body IN (${bodyTypesIn})`)
        }
      }

      if (params.make) {
        conditions.push(`v.make = $${paramIndex++}`)
        values.push(params.make.toUpperCase())
      }
      if (params.model) {
        conditions.push(`v.model = $${paramIndex++}`)
        values.push(params.model.toUpperCase())
      }
      if (params.model_detail) {
        conditions.push(`v.model_detail = $${paramIndex++}`)
        values.push(params.model_detail.toUpperCase())
      }
      if (params.year_min !== undefined) {
        conditions.push(`v.year >= $${paramIndex++}`)
        values.push(params.year_min)
      }
      if (params.year_max !== undefined) {
        conditions.push(`v.year <= $${paramIndex++}`)
        values.push(params.year_max)
      }
      if (params.status) {
        conditions.push(`l.status = $${paramIndex++}`)
        values.push(params.status.toLowerCase())
      }

      // Build ORDER BY clause
      let orderBy = ''
      switch (sort) {
        case 'auction_date_desc':
          orderBy = 'l.auction_datetime_utc DESC NULLS LAST, v.vin ASC'
          break
        case 'auction_date_asc':
          orderBy = 'l.auction_datetime_utc ASC NULLS LAST, v.vin ASC'
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
      values.push(limit + 1)
      const limitParamIndex = paramIndex++

      const query = `
        SELECT
          v.vin, v.make, v.model, v.year, v.body, v.updated_at,
          l.id as lot_id, l.status, l.site_code, l.city, l.region, l.country,
          l.auction_datetime_utc, l.retail_value_usd, l.damage_description, l.title_type, l.odometer,
          l.buy_it_now_usd, l.current_bid_usd,
          get_taxonomy_label('body_styles', v.body, $${langParamIndex}) as body_label,
          get_taxonomy_label('statuses', l.status, $${langParamIndex}) as status_label,
          get_taxonomy_label('damage_types', normalize_damage_code(l.damage_description), $${langParamIndex}) as damage_label,
          get_taxonomy_label('title_types', l.title_type, $${langParamIndex}) as title_label
        FROM vehicles v
        LEFT JOIN lots l ON l.vin = v.vin
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${limitParamIndex}
      `

      console.log('[SSR] Running query with params:', params)
      const result = await client.query(query, values)
      console.log('[SSR] Query returned', result.rows.length, 'rows')

      const hasMore = result.rows.length > limit
      const items = result.rows.slice(0, limit)

      // Generate next cursor if there are more results
      let nextCursor: string | null = null
      if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1]
        const cursorData = {
          lastVin: lastItem.vin,
          lastAuctionDate: lastItem.auction_datetime_utc,
          lastYear: lastItem.year,
        }
        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64url')
      }

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
          primaryImageUrl: null,
          imageCount: 0,
          updatedAt: row.updated_at,
        })),
        pagination: {
          nextCursor,
          hasMore,
          count: items.length,
        },
        filters: {
          make: params.make,
          model: params.model,
          modelDetail: params.model_detail,
          yearMin: params.year_min,
          yearMax: params.year_max,
          status: params.status,
          siteCode: undefined,
          country: undefined,
          limit,
          sort,
        },
        lang,
      }
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[SSR] Database query failed:', error)
    return null
  }
}

/**
 * Transform API response to VehicleLite format for catalog cards
 */
export function transformVehicles(response: SearchResponse) {
  return response.items.map((item) => ({
    vin: item.vin,
    year: item.year || 0,
    make: item.make || '',
    model: item.model || '',
    damage: item.damageLabel || item.damageDescription || 'Unknown',
    title: item.titleLabel || item.titleType || 'Unknown',
    location: [item.city, item.region, item.country].filter(Boolean).join(', ') || 'Unknown',
    status: item.status || 'unknown',
    statusLabel: item.statusLabel || undefined,
    auctionDateTimeUtc: item.auctionDateTimeUtc || undefined,
    estMin: item.estRetailValueUsd || undefined,
    estMax: item.estRetailValueUsd || undefined,
    buyNow: (item as any).buyItNowUsd || undefined,
    currentBid: (item as any).currentBidUsd || undefined,
    finalBid: undefined,
  }))
}
