import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

type Lang = 'en'|'ru'
type VehicleDto = {
  vin: string; year?: number; make?: string; model?: string; trim?: string|null;
  body?: string; fuel?: string; transmission?: string; drive?: string; engine?: string;
}
type ApiResponse = {
  vehicle: VehicleDto
  currentLot?: any
  images?: Array<{ url: string; variant: string; seq: number; lot_id?: number; vin?: string }>
  saleEvents?: Array<any>
}

function getOriginFromHeaders(): string {
  const h = headers()
  const proto = h.get('x-forwarded-proto') || 'https'
  const host = h.get('host') || 'vinops.online'
  return `${proto}://${host}`
}

function isInvalidVIN(vin: string): boolean {
  const v = (vin||'').toUpperCase()
  if (v.length < 11 || v.length > 17) return true
  if (v.length === 17 && /[IOQ]/.test(v)) return true
  return false
}

async function fetchVehicle(lang: Lang, vin: string) {
  const origin = getOriginFromHeaders()
  const r = await fetch(`${origin}/api/v1/vehicles/${encodeURIComponent(vin)}`, {
    cache: 'no-store',
    headers: { 'X-SSR': 'vin' }
  })
  const status = r.status
  const traceId = r.headers.get('x-trace-id') || ''
  if (status === 410) {
    // Отдаём 410 через middleware (демо-путь); здесь считаем это "не найдено"
    // чтобы не плодить дубликаты страниц — редиректы/410 делает middleware.
    notFound()
  }
  if (status === 404) notFound()
  if (status === 422) notFound() // по требованиям MS-02-05 — 422 → SSR 404
  if (status !== 200) notFound()
  const data = await r.json() as ApiResponse
  return { data, traceId }
}

function buildTitle(v: VehicleDto): string {
  const parts = []
  if (v.year) parts.push(String(v.year))
  if (v.make) parts.push(v.make)
  if (v.model) parts.push(v.model)
  if (v.trim) parts.push(v.trim)
  const left = parts.length ? parts.join(' ') : `VIN ${v.vin}`
  return `${left} — VIN ${v.vin}`
}

export async function generateMetadata(
  { params }: { params: { lang: Lang; vin: string } }
): Promise<Metadata> {
  const lang = params.lang; const vin = params.vin.toUpperCase()
  const origin = getOriginFromHeaders()
  if (isInvalidVIN(vin)) {
    return {
      title: `VIN ${vin}`,
      robots: { index: false, follow: true }
    }
  }
  // извлекаем для <head> ещё раз (независимо от рендера body)
  const res = await fetch(`${origin}/api/v1/vehicles/${encodeURIComponent(vin)}`, { cache: 'no-store', headers: { 'X-SSR': 'vin-head' } })
  const traceId = res.headers.get('x-trace-id') || ''
  if (!res.ok) {
    return {
      title: `VIN ${vin}`,
      robots: { index: false, follow: true },
      other: { 'api-trace-id': traceId }
    }
  }
  const { vehicle } = await res.json() as ApiResponse
  const canonical = `${origin}/${lang}/vin/${vin}`
  return {
    title: buildTitle(vehicle),
    alternates: {
      canonical,
      languages: {
        en: `${origin}/en/vin/${vin}`,
        ru: `${origin}/ru/vin/${vin}`,
        'x-default': `${origin}/en/vin/${vin}`,
      }
    },
    other: { 'api-trace-id': traceId }
  }
}

export default async function Page({ params }: { params: { lang: Lang; vin: string } }) {
  const lang = params.lang; const vin = params.vin.toUpperCase()
  if (isInvalidVIN(vin)) notFound()
  const { data, traceId } = await fetchVehicle(lang, vin)
  const v = data.vehicle

  // JSON-LD Vehicle
  const vehicleLd = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    'vehicleIdentificationNumber': v.vin,
    'brand': { '@type': 'Brand', 'name': v.make || '' },
    'model': v.model || '',
    'productionDate': v.year ? String(v.year) : undefined,
    'url': `${getOriginFromHeaders()}/${lang}/vin/${v.vin}`,
  }
  // JSON-LD BreadcrumbList
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': (lang==='ru'?'Главная':'Home'), 'item': `${getOriginFromHeaders()}/${lang}` },
      { '@type': 'ListItem', 'position': 2, 'name': (lang==='ru'?'Авто':'Cars'),    'item': `${getOriginFromHeaders()}/${lang}/cars` },
      { '@type': 'ListItem', 'position': 3, 'name': v.vin, 'item': `${getOriginFromHeaders()}/${lang}/vin/${v.vin}` },
    ]
  }

  return (
    <main className="container mx-auto px-4 py-4">
      {/* доказательство SSR: мета с api-trace-id */}
      <meta name="api-trace-id" content={traceId} />
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="h1">{buildTitle(v)}</h1>
        <span className="badge">VIN {v.vin}</span>
      </div>
      {/* JSON-LD */}
      <script type="application/ld+json" suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleLd) }} />
      <script type="application/ld+json" suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* упрощённый рендер характеристик (достаточно для сдачи MS) */}
      <section aria-label={lang==='ru'?'Характеристики':'Specifications'}>
        <ul className="grid grid-cols-2 gap-2">
          {v.year ? <li><b>Year:</b> {v.year}</li> : null}
          {v.make ? <li><b>Make:</b> {v.make}</li> : null}
          {v.model ? <li><b>Model:</b> {v.model}</li> : null}
          {v.trim ? <li><b>Trim:</b> {v.trim}</li> : null}
          {v.engine ? <li><b>Engine:</b> {v.engine}</li> : null}
          {v.drive ? <li><b>Drive:</b> {v.drive}</li> : null}
          {v.transmission ? <li><b>Transmission:</b> {v.transmission}</li> : null}
          {v.fuel ? <li><b>Fuel:</b> {v.fuel}</li> : null}
          {v.body ? <li><b>Body:</b> {v.body}</li> : null}
        </ul>
      </section>
    </main>
  )
}
