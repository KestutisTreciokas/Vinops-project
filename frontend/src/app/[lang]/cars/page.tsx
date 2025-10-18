import { Suspense } from 'react'
import type { Metadata } from 'next'
import PageClient from './PageClient'
import { fetchVehicles, transformVehicles } from './_api'

import { type VehicleType } from '@/lib/vehicleTypes'

export default async function Page({
  params,
  searchParams
}: {
  params: { lang: 'en'|'ru' }
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const lang = params.lang

  // Extract search parameters
  // Default type to 'auto' if not provided to prevent regressions (status badge, filters)
  const type = (typeof searchParams.type === 'string' ? searchParams.type : 'auto') as VehicleType
  const make = typeof searchParams.make === 'string' ? searchParams.make : undefined
  const model = typeof searchParams.model === 'string' ? searchParams.model : undefined
  const modelDetail = typeof searchParams.detail === 'string' ? searchParams.detail : undefined
  const year = searchParams.year ? Number(searchParams.year) : undefined
  const page = searchParams.page ? Number(searchParams.page) || 1 : 1

  // Fetch vehicles from API with default type='auto'
  const response = await fetchVehicles({
    vehicleType: type, // Now always has a value (defaults to 'auto')
    make,
    model,
    model_detail: modelDetail,
    year_min: year,
    year_max: year,
    status: 'active', // Only show active lots
    limit: 100, // Show 100 vehicles initially
    lang,
    sort: 'auction_date_desc' // Sort by auction date (has index)
  })

  // Transform to VehicleLite format
  const vehicles = response ? transformVehicles(response) : []
  const pagination = response?.pagination || { hasMore: false, count: 0, nextCursor: null }

  return (
    <Suspense fallback={<div className="container-prose py-8 text-sm text-fg-muted">Loading…</div>}>
      <PageClient
        params={params}
        initialVehicles={vehicles}
        initialPagination={pagination}
      />
    </Suspense>
  )
}

export async function generateMetadata(
  { params }: { params: { lang: 'en'|'ru' } }
): Promise<Metadata> {
  const { lang } = params
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const PATH = '/cars'
  const canonical = `/${lang}${PATH}`
  const title = t('Car catalog', 'Каталог автомобилей')
  const description = t('Browse cars and filter by attributes.', 'Просматривайте автомобили и фильтруйте по параметрам.')

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `/en${PATH}`,
        ru: `/ru${PATH}`,
        'x-default': `/en${PATH}`,
      },
    },
    openGraph: {
      url: canonical,
      title: `${title} — vinops`,
      description,
      type: 'website',
    },
    robots: { index: true, follow: true },
  }
}
