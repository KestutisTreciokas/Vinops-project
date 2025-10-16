import CopyButton from './CopyButton'
import StatusBadge from './StatusBadge'

type Props = {
  vin: string
  priceUSD?: number
  status?: 'active' | 'sold'
  ctaHref?: string
}

export default function AsideSummary({ vin, priceUSD, status = 'active', ctaHref = '#' }: Props) {
  return (
    <aside className="sticky top-24">
      <div className="card p-4 rounded-2xl bg-surface shadow-sm border border-border-muted">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-fg-muted text-sm">VIN</span>
            <code className="font-mono text-fg-default">{vin}</code>
          </div>
          <CopyButton text={vin} />
        </div>

        <div className="mb-4">
          <div className="text-fg-muted text-sm mb-1">Current price</div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-semibold text-fg-default" data-price>
              {priceUSD ? `$${priceUSD.toLocaleString()}` : '—'}
            </div>
            <StatusBadge status={status} />
          </div>
        </div>

        <a href={ctaHref} className="btn btn-primary btn-lg w-full">Связаться</a>
      </div>
    </aside>
  )
}
