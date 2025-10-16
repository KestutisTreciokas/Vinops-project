'use client'

type Status = 'sold' | 'active' | 'no_sale' | string

const MAP: Record<string, { label: string; className: string }> = {
  sold:     { label: 'Sold',    className: 'badge badge--sold' },
  active:   { label: 'Active',  className: 'badge badge--active' },
  no_sale:  { label: 'No Sale', className: 'badge badge--nosale' },
}

export default function StatusBadge({ value, lang='en' }: { value?: Status; lang?: 'ru'|'en' }) {
  const v = (value || '').toString().toLowerCase().replace(/\s+/g,'_')
  const item = MAP[v] || { label: value || '—', className: 'badge' }
  const label = (lang==='ru')
    ? (v==='sold'?'Продано': v==='active'?'Активен': v==='no_sale'?'Не продано': item.label)
    : item.label
  return <span className={item.className} data-status={v}>{label}</span>
}
