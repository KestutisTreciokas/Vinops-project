import Link from 'next/link'
import PriceBadge from '@/components/catalog/PriceBadge'

export type VehicleLite = {
  year: number
  make: string
  model: string
  damage: string
  title: string
  location: string
  vin: string
  image?: string | null
  status?: 'ACTIVE' | 'SOLD'
  price?: string | null   // форматируем заранее, чтобы не тянуть Intl
}

interface VehicleCardProps {
  v: VehicleLite
  lang?: 'en' | 'ru'
}

export default function VehicleCard({ v, lang = 'en' }: VehicleCardProps) {
  const t = (en: string, ru: string) => lang === 'ru' ? ru : en

  const statusClass = v.status === 'SOLD' ? 'badge badge-sold' : v.status === 'ACTIVE' ? 'badge badge-live' : 'badge'
  const statusLabel = v.status === 'SOLD' ? t('Sold', 'Продано') : v.status === 'ACTIVE' ? t('Active', 'Активно') : ''
  const vinPageUrl = `/${lang}/vin/${v.vin}` as `/en/vin/${string}` | `/ru/vin/${string}`

  return (
    <Link href={vinPageUrl} className="vehicle-card-link">
      <article className="vehicle-card">
        <div className="vimgwrap">
          {/* сюда позже придёт <Image src=.../> */}
          <div className="vimg" />
          {statusLabel ? <span className={statusClass}>{statusLabel}</span> : null}
          {v.price ? <span data-price className="price-chip">{v.price}</span> : null}
        </div>
        <div className="vbody">
          <div className="vtitle">{v.year} {v.make} {v.model}</div>
          <div className="vmeta">{v.damage} • {v.title} • {v.location}</div>
          <div className="vvin">VIN {v.vin}</div>
        </div>
      </article>
    </Link>
  )
}
