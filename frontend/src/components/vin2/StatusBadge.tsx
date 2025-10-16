'use client'

const MAP: Record<string, { ru: string; en: string; cls: string }> = {
  sold:       { ru: 'Продано',    en: 'Sold',     cls: 'bg-emerald-600/90 text-white' },
  active:     { ru: 'Активен',    en: 'Active',   cls: 'bg-blue-600/90 text-white' },
  upcoming:   { ru: 'Скоро',      en: 'Upcoming', cls: 'bg-amber-500/90 text-black' },
  on_approval:{ ru: 'Подтвержд.', en: 'On approval', cls: 'bg-zinc-500/90 text-white' },
}

export default function StatusBadge({
  status,
  lang = 'ru',
}: {
  status?: string | null
  lang?: 'ru' | 'en'
}) {
  if (!status) return null
  const key = String(status).trim().toLowerCase().replace(/\s+/g, '_')
  const m = MAP[key]
  if (!m) return null
  const text = lang === 'ru' ? m.ru : m.en
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium shadow-sm ${m.cls}`}>
      {text}
    </span>
  )
}
