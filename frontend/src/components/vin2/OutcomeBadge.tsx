'use client'

const MAP: Record<string, { ru: string; en: string; cls: string }> = {
  sold:         { ru: 'Продано',       en: 'Sold',          cls: 'bg-emerald-600/90 text-white' },
  not_sold:     { ru: 'Не продано',    en: 'Not Sold',      cls: 'bg-red-600/90 text-white' },
  on_approval:  { ru: 'На согласов.',  en: 'On Approval',   cls: 'bg-amber-500/90 text-black' },
  unknown:      { ru: 'Неизвестно',    en: 'Unknown',       cls: 'bg-zinc-400/90 text-white' },
}

export interface OutcomeBadgeProps {
  /** Outcome status from CSV-only heuristic detection */
  outcome?: 'sold' | 'not_sold' | 'on_approval' | 'unknown' | null
  /** Optional confidence score to display (0.00-1.00) */
  confidence?: number | null
  /** Language for badge text */
  lang?: 'ru' | 'en'
  /** Show confidence indicator (default: false) */
  showConfidence?: boolean
}

export default function OutcomeBadge({
  outcome,
  confidence,
  lang = 'ru',
  showConfidence = false,
}: OutcomeBadgeProps) {
  if (!outcome) return null

  const key = String(outcome).trim().toLowerCase().replace(/\s+/g, '_')
  const m = MAP[key]
  if (!m) return null

  const text = lang === 'ru' ? m.ru : m.en
  const confidencePercent = confidence ? Math.round(confidence * 100) : null

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm ${m.cls}`}>
      <span>{text}</span>
      {showConfidence && confidencePercent !== null && (
        <span className="opacity-80">({confidencePercent}%)</span>
      )}
    </span>
  )
}
