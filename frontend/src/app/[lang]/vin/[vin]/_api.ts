/**
 * Server-side API fetching utilities for VIN pages
 * Sprint: S2 — SSR/SEO VIN & Catalog
 * Milestone: MS-S2-04 — SSR VIN Pages
 */

import type { VehicleDetailsResponse, ApiErrorResponse } from '@/contracts/types/api-v1'

/**
 * Fetch vehicle details from API v1 (server-side only)
 * @param vin Vehicle Identification Number
 * @param lang Language for taxonomy labels ('en' or 'ru')
 * @returns Vehicle details or null if not found
 */
export async function fetchVehicleDetails(
  vin: string,
  lang: 'en' | 'ru' = 'en'
): Promise<VehicleDetailsResponse | null> {
  try {
    // Use internal API URL (server-side)
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'
    const url = `${apiBase}/api/v1/vehicles/${vin}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': lang,
      },
      // SSR: fetch once per render, cache for 60 seconds
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      // Handle 404 gracefully (VIN not found)
      if (response.status === 404) {
        return null
      }

      // Log other errors but don't crash
      console.error(`[SSR] API error ${response.status} for VIN ${vin}`)
      return null
    }

    const data: VehicleDetailsResponse = await response.json()
    return data
  } catch (error) {
    console.error(`[SSR] Failed to fetch VIN ${vin}:`, error)
    return null
  }
}

/**
 * Transform API response to component-friendly format
 * This maintains backward compatibility with existing components
 */
export function transformVehicleData(data: VehicleDetailsResponse) {
  const { currentLot, images, saleEvents } = data

  return {
    specs: {
      year: data.year,
      make: data.make,
      model: data.model,
      trim: data.trim,
      body: data.bodyLabel || data.body,
      fuel: data.fuelLabel || data.fuel,
      transmission: data.transmissionLabel || data.transmission,
      drive: data.driveLabel || data.drive,
      engine: data.engine,
    },
    lot: currentLot
      ? {
          lotId: currentLot.lotId,
          status: currentLot.statusLabel || currentLot.status,
          location: [currentLot.city, currentLot.region, currentLot.country]
            .filter(Boolean)
            .join(', '),
          siteCode: currentLot.siteCode,
          auctionDate: currentLot.auctionDateTimeUtc,
          estimatedValue: currentLot.estRetailValueUsd,
          runsDrives: currentLot.runsDrives,
          hasKeys: currentLot.hasKeys,
          damage: currentLot.damageLabel || currentLot.damageDescription,
          title: currentLot.titleLabel || currentLot.titleType,
          odometer: currentLot.odometer,
          odometerBrand: currentLot.odometerBrandLabel || currentLot.odometerBrand,
          color: currentLot.colorLabel || currentLot.color,
        }
      : null,
    photos:
      images?.map((img) => ({
        url: img.url,
        alt: `${data.make} ${data.model} - Image ${img.seq}`,
      })) || [],
    history:
      saleEvents?.map((event) => ({
        date: event.occurred_at_utc,
        event: event.event_type,
        price: event.price_usd,
      })) || [],
  }
}
