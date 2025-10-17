import Link from 'next/link'
import PriceBadge from '@/components/catalog/PriceBadge'
import StatusBadge from '@/components/common/StatusBadge'

export type VehicleLite = {
  year: number
  make: string
  model: string
  damage: string
  title: string
  location: string
  vin: string
  image?: string | null
  status?: string
  statusLabel?: string
  estMin?: number
  estMax?: number
  finalBid?: number
  buyNow?: number
  currentBid?: number
  startingBid?: number
}

interface VehicleCardProps {
  v: VehicleLite
  lang?: 'en' | 'ru'
}

export default function VehicleCard({ v, lang = 'en' }: VehicleCardProps) {
  const vinPageUrl = `/${lang}/vin/${v.vin}` as `/en/vin/${string}` | `/ru/vin/${string}`

  // Убираем слово "повреждение:" из damage для русского языка
  const damage = lang === 'ru'
    ? v.damage.replace(/повреждение:\s*/gi, '').trim()
    : v.damage

  return (
    <Link href={vinPageUrl} className="vehicle-card-link">
      <article className="vehicle-card">
        <div className="vimgwrap">
          <div className="vimg" />
          {v.status && <StatusBadge value={v.status} lang={lang} />}
          <PriceBadge item={v} lang={lang} className="card-price-badge" />
        </div>
        <div className="vbody">
          <div className="vtitle">{v.year} {v.make} {v.model}</div>
          <div className="vmeta">{damage} • {v.title} • {v.location}</div>
          <div className="vvin">VIN {v.vin}</div>
        </div>
      </article>
    </Link>
  )
}
