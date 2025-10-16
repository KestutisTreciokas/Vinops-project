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

const shortVin = (vin:string) => (vin.length>10 ? `${vin.slice(0,8)}…${vin.slice(-4)}` : vin)

export default function VehicleCard({v}:{v:VehicleLite}) {
  const statusClass = v.status === 'SOLD' ? 'badge badge-sold' : v.status === 'ACTIVE' ? 'badge badge-live' : 'badge'
  const statusLabel = v.status === 'SOLD' ? 'Sold' : v.status === 'ACTIVE' ? 'Active' : ''

  return (
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
        <div className="vvin">VIN {shortVin(v.vin)}</div>
      </div>
    </article>
  )
}
