'use client'

type Status = string

interface StatusConfig {
  label: string
  labelRu: string
  className: string
}

/**
 * StatusBadge - Shows the lot status (Sold, Active, Upcoming, etc.)
 */
export default function StatusBadge({
  value,
  lang = 'en'
}: {
  value?: Status
  lang?: 'ru' | 'en'
}) {
  const status = (value || '').toString().toLowerCase()

  const MAP: Record<string, StatusConfig> = {
    sold: { label: 'Sold', labelRu: 'Продано', className: 'badge badge--sold' },
    active: { label: 'Active', labelRu: 'Активен', className: 'badge badge--active' },
    live: { label: 'Live Now', labelRu: 'Идут торги', className: 'badge badge--active' },
    upcoming: { label: 'Upcoming', labelRu: 'Скоро', className: 'badge badge--upcoming' },
    pending_result: { label: 'On Approval', labelRu: 'На утверждении', className: 'badge badge--pending' },
    on_approval: { label: 'On Approval', labelRu: 'На утверждении', className: 'badge badge--pending' },
    not_sold: { label: 'Not Sold', labelRu: 'Не продано', className: 'badge badge--nosale' },
    no_sale: { label: 'Not Sold', labelRu: 'Не продано', className: 'badge badge--nosale' },
    no_bids: { label: 'No Bids', labelRu: 'Нет ставок', className: 'badge badge--nosale' },
    cancelled: { label: 'Cancelled', labelRu: 'Отменён', className: 'badge badge--nosale' },
    withdrawn: { label: 'Withdrawn', labelRu: 'Отозван', className: 'badge badge--nosale' },
  }

  const normalized = status.replace(/\s+/g, '_')
  const config = MAP[normalized] || { label: 'Active', labelRu: 'Активен', className: 'badge badge--neutral' }
  const label = lang === 'ru' ? config.labelRu : config.label

  return <span className={config.className} data-status={normalized}>{label}</span>
}
