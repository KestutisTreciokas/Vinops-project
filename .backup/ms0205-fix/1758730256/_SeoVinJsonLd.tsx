/**
 * MS-02-05: JSON-LD (Vehicle + BreadcrumbList) из реальных данных.
 */
'use client' // разрешаем встраивание как обычного скрипта
import React from 'react'

type VehicleCore = {
  vin: string
  year?: number | null
  make?: string | null
  model?: string | null
  trim?: string | null
}

export default function SeoVinJsonLd(props: {
  lang: 'en'|'ru',
  vin: string,
  vehicle?: VehicleCore | null,
  absoluteUrl: string,
  homeUrl: string,
}) {
  const { lang, vin, vehicle, absoluteUrl, homeUrl } = props
  const y = vehicle?.year ? String(vehicle.year) : ''
  const mm = [vehicle?.make, vehicle?.model].filter(Boolean).join(' ').trim()
  const nm = [y, mm].filter(Boolean).join(' ').trim()
  const name = nm ? `${nm}${vehicle?.trim ? `, ${vehicle.trim}` : ''}` : `Vehicle by VIN ${vin}`

  const payload = [
    {
      '@context': 'https://schema.org',
      '@type': 'Vehicle',
      name,
      vehicleIdentificationNumber: vin,
      url: absoluteUrl,
      inLanguage: lang,
      ...(vehicle?.make ? { brand: { '@type': 'Brand', name: vehicle.make } } : {}),
      ...(vehicle?.model ? { model: vehicle.model } : {}),
      ...(vehicle?.year ? { productionDate: String(vehicle.year) } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: homeUrl },
        { '@type': 'ListItem', position: 2, name: 'VIN page', item: absoluteUrl },
      ],
    },
  ]

  return (
    <script
      id="ld-vehicle"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  )
}
