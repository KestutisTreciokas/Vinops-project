'use client'

export interface PriceInfoProps {
  /** Last known bid from CSV (pre-auction) */
  currentBidUsd?: number | null
  /** Final sale price (null for CSV-only, populated if third-party API added) */
  finalBidUsd?: number | null
  /** Language for labels */
  lang?: 'ru' | 'en'
  /** Display variant: 'inline' or 'block' */
  variant?: 'inline' | 'block'
}

const LABELS = {
  lastKnownBid: { ru: 'Последняя ставка', en: 'Last Known Bid' },
  finalPrice: { ru: 'Финальная цена', en: 'Final Price' },
  disclaimer: { ru: '(Финальная цена может отличаться)', en: '(Final price may vary)' },
}

function formatUSD(amount: number | null | undefined): string | null {
  if (amount == null) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function PriceInfo({
  currentBidUsd,
  finalBidUsd,
  lang = 'ru',
  variant = 'block',
}: PriceInfoProps) {
  // If we have final bid from third-party API, show that
  if (finalBidUsd != null) {
    return (
      <div className={variant === 'inline' ? 'inline-flex items-center gap-2' : 'space-y-1'}>
        <div className="text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {lang === 'ru' ? LABELS.finalPrice.ru : LABELS.finalPrice.en}:
          </span>{' '}
          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">
            {formatUSD(finalBidUsd)}
          </span>
        </div>
      </div>
    )
  }

  // CSV-only: show last known bid with disclaimer
  if (currentBidUsd != null) {
    return (
      <div className={variant === 'inline' ? 'inline-flex items-center gap-2' : 'space-y-1'}>
        <div className="text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {lang === 'ru' ? LABELS.lastKnownBid.ru : LABELS.lastKnownBid.en}:
          </span>{' '}
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            {formatUSD(currentBidUsd)}
          </span>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 italic">
          {lang === 'ru' ? LABELS.disclaimer.ru : LABELS.disclaimer.en}
        </div>
      </div>
    )
  }

  return null
}
