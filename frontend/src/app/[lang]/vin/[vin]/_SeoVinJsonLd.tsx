/**
 * VIN JSON-LD (Vehicle + BreadcrumbList + Product), server-rendered
 * Sprint: S2 — SSR/SEO VIN & Catalog
 * Milestone: MS-S2-04 — SSR VIN Pages
 */
import React from 'react'
import type { VehicleDetailsResponse } from '@/contracts/types/api-v1'

interface Props {
  lang: 'en' | 'ru'
  vin: string
  vehicleData: VehicleDetailsResponse
}

export default function SeoVinJsonLd({ lang, vin, vehicleData }: Props) {
  const base = 'https://vinops.online'
  const url = `${base}/${lang}/vin/${vin}`
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  const { year, make, model, currentLot } = vehicleData
  const vehicleName = [year, make, model].filter(Boolean).join(' ')

  // Vehicle schema
  const vehicle: any = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: vehicleName || t(`Vehicle by VIN ${vin}`, `Авто по VIN ${vin}`),
    vehicleIdentificationNumber: vin,
    url,
    inLanguage: lang,
  }

  // Add optional fields if available
  if (year) vehicle.vehicleModelDate = year.toString()
  if (make) vehicle.manufacturer = { '@type': 'Organization', name: make }
  if (model) vehicle.model = model
  if (vehicleData.bodyLabel) vehicle.bodyType = vehicleData.bodyLabel
  if (vehicleData.fuelLabel) vehicle.fuelType = vehicleData.fuelLabel
  if (vehicleData.driveLabel) vehicle.driveWheelConfiguration = vehicleData.driveLabel
  if (vehicleData.engine) vehicle.vehicleEngine = { '@type': 'EngineSpecification', name: vehicleData.engine }
  if (currentLot?.odometer) vehicle.mileageFromOdometer = { '@type': 'QuantitativeValue', value: currentLot.odometer, unitCode: 'SMI' }
  if (currentLot?.colorLabel) vehicle.color = currentLot.colorLabel

  // Product schema (for auction listing)
  const product: any = currentLot
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: vehicleName || `VIN ${vin}`,
        description: t(
          `${vehicleName || 'Vehicle'} with VIN ${vin}. ${currentLot.damageLabel || 'Salvage'} vehicle. ${currentLot.statusLabel || 'For sale'}.`,
          `${vehicleName || 'Автомобиль'} с VIN ${vin}. ${currentLot.damageLabel || 'Битый'} автомобиль. ${currentLot.statusLabel || 'На продаже'}.`
        ),
        sku: vin,
        ...(currentLot.primaryImageUrl && { image: currentLot.primaryImageUrl }),
        ...(currentLot.estRetailValueUsd && {
          offers: {
            '@type': 'Offer',
            price: currentLot.estRetailValueUsd,
            priceCurrency: 'USD',
            availability: currentLot.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url,
          },
        }),
      }
    : null

  // Breadcrumbs schema
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('Home', 'Главная'), item: `${base}/${lang}` },
      { '@type': 'ListItem', position: 2, name: t('VIN Search', 'Поиск по VIN'), item: `${base}/${lang}/cars` },
      { '@type': 'ListItem', position: 3, name: vehicleName || `VIN ${vin}`, item: url },
    ],
  }

  const payload = [vehicle, product, breadcrumbs].filter(Boolean)

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  )
}
