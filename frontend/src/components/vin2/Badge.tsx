'use client'

type Status = 'sold'|'active'|'pending'|'upcoming'|string

export default function StatusBadge({ status, lang='ru' }: { status?: Status; lang?: 'ru'|'en' }) {
  const s = String(status || '').toLowerCase()
  const map: Record<string, {ru:string; en:string; cls:string}> = {
    sold:      { ru:'Продан',   en:'Sold',      cls:'badge--sold' },
    active:    { ru:'Активен',  en:'Active',    cls:'badge--active' },
    pending:   { ru:'Ожидается',en:'Pending',   cls:'badge--pending' },
    upcoming:  { ru:'Скоро',    en:'Upcoming',  cls:'badge--upcoming' },
  }
  const item = map[s] ?? { ru: status || '—', en: status || '—', cls:'badge--neutral' }
  const text = lang === 'ru' ? item.ru : item.en
  return <span className={`badge ${item.cls}`}>{text}</span>
}
