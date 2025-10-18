import Link from 'next/link'
import PriceBadge from '@/components/catalog/PriceBadge'
import StatusBadge from '@/components/common/StatusBadge'
import OutcomeBadge from '@/components/vin2/OutcomeBadge'
import { computeDisplayStatus } from '@/lib/computeDisplayStatus'

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
  auctionDateTimeUtc?: string
  estMin?: number
  estMax?: number
  finalBid?: number
  buyNow?: number
  currentBid?: number
  startingBid?: number
  // CSV-only outcome detection fields
  outcome?: 'sold' | 'not_sold' | 'on_approval' | 'unknown'
  outcomeConfidence?: number
  outcomeDate?: string | null
  relistCount?: number
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

  // Compute display status based on auction lifecycle
  const displayStatus = computeDisplayStatus({
    status: v.status,
    auctionDateTimeUtc: v.auctionDateTimeUtc,
    finalBid: v.finalBid,
    currentBid: v.currentBid
  })

  return (
    <Link href={vinPageUrl} className="vehicle-card-link">
      <article className="vehicle-card">
        <div className="vimgwrap">
          <div className="vimg" />
          <StatusBadge value={displayStatus} lang={lang} />
          <PriceBadge item={v} lang={lang} className="card-price-badge" />
        </div>
        <div className="vbody">
          <div className="vtitle">{v.year} {v.make} {v.model}</div>
          <div className="vmeta">{damage} • {v.title} • {v.location}</div>
          <div className="vvin">VIN {v.vin}</div>
          {v.outcome && (
            <div className="voutcome" style={{ marginTop: '0.5rem' }}>
              <OutcomeBadge
                outcome={v.outcome}
                confidence={v.outcomeConfidence}
                lang={lang}
                showConfidence={false}
              />
            </div>
          )}
        </div>
      </article>
    </Link>
  )
}
